import {
  findPeaks,
  linearInterpolate,
  detrend,
  bandpassFilter,
  hammingWindow,
  fft,
  magnitudeSpectrum,
  findDominantPeak,
  nextPowerOf2,
} from './signal';
import { RateTracker } from './rate-tracker';
import type { RppgResult } from './rppg';
import type { BreathEstimate } from './breathing';
import {
  CAMERA_FPS,
  BPM_MIN,
  BPM_MAX,
  BREATH_FREQ_MIN,
  BREATH_FREQ_MAX,
  BREATH_MIN,
  BREATH_MAX,
} from '../utils/constants';

export interface HrvMetrics {
  sdnn: number;
  rmssd: number;
}

export interface FusedVitals {
  bpm: number | null;
  bpmConfidence: number;
  breathRate: number | null;
  breathConfidence: number;
  hrv: HrvMetrics | null;
  signal: Float64Array;
}

/**
 * Measurement noise base variances (empirically calibrated).
 *
 * Each source has a "base" variance representing its noise floor when
 * the spectral confidence is high. Actual measurement variance passed
 * to the Kalman filter is base / max(confidence, floor), so low-confidence
 * readings are down-weighted automatically.
 */
const HR_BASE_VAR = 4; // ±2 bpm at peak confidence
const BREATH_MOTION_BASE_VAR = 9; // ±3 br/min — motion is noisier
const BREATH_LANDMARK_BASE_VAR = 4; // ±2 br/min — landmarks are more precise
const BREATH_RSA_BASE_VAR = 12; // ±3.5 br/min — indirect, discounted

const CONFIDENCE_FLOOR = 0.05;
const TACHOGRAM_RATE = 4; // Hz, uniform resampling rate for RR intervals
const MIN_BEATS_FOR_RSA = 15;
const MIN_BEATS_FOR_HRV = 8;
const MIN_RR_SEC = 60 / BPM_MAX;
const MAX_RR_SEC = 60 / BPM_MIN;

function measurementVariance(baseVar: number, confidence: number): number {
  return baseVar / Math.max(confidence, CONFIDENCE_FLOOR);
}

export class VitalsFusion {
  private hrTracker = new RateTracker(0.25);
  private breathTracker = new RateTracker(0.06);
  private lastUpdateTime = 0;

  update(
    rppgResult: RppgResult | null,
    breathEstimates: BreathEstimate[],
    now: number,
  ): FusedVitals {
    const dt = this.lastUpdateTime > 0 ? (now - this.lastUpdateTime) / 1000 : 2;
    this.lastUpdateTime = now;

    this.hrTracker.predict(dt);
    this.breathTracker.predict(dt);

    let signal: Float64Array = new Float64Array(0);
    let rrIntervals: number[] = [];
    let peakPositions: number[] = [];

    if (rppgResult) {
      signal = new Float64Array(rppgResult.signal);

      this.hrTracker.update(
        rppgResult.rawBpm,
        measurementVariance(HR_BASE_VAR, rppgResult.confidence),
      );

      const minPeakDist = Math.floor((CAMERA_FPS * 60) / BPM_MAX);
      const peaks = findPeaks(rppgResult.filteredSignal, minPeakDist);
      peakPositions = peaks;

      for (let i = 1; i < peaks.length; i++) {
        const rrSec = (peaks[i] - peaks[i - 1]) / CAMERA_FPS;
        if (rrSec >= MIN_RR_SEC && rrSec <= MAX_RR_SEC) {
          rrIntervals.push(rrSec);
        }
      }
    }

    if (peakPositions.length >= MIN_BEATS_FOR_RSA && rrIntervals.length >= MIN_BEATS_FOR_RSA - 1) {
      const rsaResult = this.extractRSABreathing(peakPositions, rrIntervals);
      if (rsaResult) {
        this.breathTracker.update(
          rsaResult.rate,
          measurementVariance(BREATH_RSA_BASE_VAR, rsaResult.confidence),
        );
      }
    }

    for (const est of breathEstimates) {
      const baseVar = est.source === 'landmark' ? BREATH_LANDMARK_BASE_VAR : BREATH_MOTION_BASE_VAR;
      this.breathTracker.update(est.rate, measurementVariance(baseVar, est.confidence));
    }

    let hrv: HrvMetrics | null = null;
    if (rrIntervals.length >= MIN_BEATS_FOR_HRV) {
      hrv = computeHRV(rrIntervals);
    }

    const bpm = this.hrTracker.initialized ? Math.round(this.hrTracker.rate) : null;
    const breathRate = this.breathTracker.initialized ? Math.round(this.breathTracker.rate) : null;

    return {
      bpm: bpm !== null && bpm >= BPM_MIN && bpm <= BPM_MAX ? bpm : null,
      bpmConfidence: this.hrTracker.initialized ? 1 / (1 + this.hrTracker.variance) : 0,
      breathRate:
        breathRate !== null && breathRate >= BREATH_MIN && breathRate <= BREATH_MAX
          ? breathRate
          : null,
      breathConfidence: this.breathTracker.initialized ? 1 / (1 + this.breathTracker.variance) : 0,
      hrv,
      signal,
    };
  }

  private extractRSABreathing(
    peakPositions: number[],
    rrIntervals: number[],
  ): { rate: number; confidence: number } | null {
    const times: number[] = [];
    for (let i = 1; i < peakPositions.length; i++) {
      times.push(peakPositions[i] / CAMERA_FPS);
    }

    if (times.length < 2 || times.length !== rrIntervals.length) return null;

    const duration = times[times.length - 1] - times[0];
    const numSamples = Math.floor(duration * TACHOGRAM_RATE);
    if (numSamples < 16) return null;

    const uniformTimes = new Float64Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      uniformTimes[i] = times[0] + i / TACHOGRAM_RATE;
    }

    const tachogram = linearInterpolate(times, rrIntervals, uniformTimes);
    const detrended = detrend(tachogram, Math.round(TACHOGRAM_RATE * 10));
    const filtered = bandpassFilter(detrended, TACHOGRAM_RATE, BREATH_FREQ_MIN, BREATH_FREQ_MAX);
    const windowed = hammingWindow(filtered);

    const n = nextPowerOf2(windowed.length * 4);
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    re.set(windowed);

    fft(re, im);
    const spectrum = magnitudeSpectrum(re, im);

    const peak = findDominantPeak(spectrum, TACHOGRAM_RATE, BREATH_FREQ_MIN, BREATH_FREQ_MAX);
    if (!peak) return null;

    const rawRate = peak.frequency * 60;
    if (rawRate < BREATH_MIN || rawRate > BREATH_MAX) return null;

    return { rate: rawRate, confidence: peak.confidence * 0.8 };
  }

  reset(): void {
    this.hrTracker.reset();
    this.breathTracker.reset();
    this.lastUpdateTime = 0;
  }
}

function computeHRV(rrIntervals: number[]): HrvMetrics {
  const n = rrIntervals.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += rrIntervals[i];
  const mean = sum / n;

  let variance = 0;
  for (let i = 0; i < n; i++) {
    const d = rrIntervals[i] - mean;
    variance += d * d;
  }
  const sdnn = Math.sqrt(variance / (n - 1)) * 1000;

  let sumSqDiff = 0;
  for (let i = 1; i < n; i++) {
    const diff = rrIntervals[i] - rrIntervals[i - 1];
    sumSqDiff += diff * diff;
  }
  const rmssd = Math.sqrt(sumSqDiff / (n - 1)) * 1000;

  return {
    sdnn: Math.round(sdnn * 10) / 10,
    rmssd: Math.round(rmssd * 10) / 10,
  };
}
