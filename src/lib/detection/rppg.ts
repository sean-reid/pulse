import {
  RingBuffer,
  detrend,
  hammingWindow,
  bandpassFilter,
  fft,
  magnitudeSpectrum,
  findDominantPeak,
  autocorrelationPeak,
  nextPowerOf2,
} from './signal';
import { SpatialBeamformer } from './spatial-beamformer';
import {
  SIGNAL_BUFFER_SIZE,
  BPM_FREQ_MIN,
  BPM_FREQ_MAX,
  BPM_MIN,
  BPM_MAX,
  ROI_SAMPLE_SIZE,
} from '../utils/constants';

export interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RppgResult {
  rawBpm: number;
  confidence: number;
  signal: Float64Array;
  filteredSignal: Float64Array;
}

const MIN_SAMPLES = 150;
const MIN_CONFIDENCE = 0.08;
const POS_WINDOW = 48;
const PIXEL_COUNT = ROI_SAMPLE_SIZE * ROI_SAMPLE_SIZE;
const CORR_HISTORY = 64;

function isSkinPixel(r: number, g: number, b: number): boolean {
  const sum = r + g + b;
  if (sum < 60) return false;
  const rn = r / sum;
  const gn = g / sum;
  return rn > 0.35 && rn < 0.6 && gn > 0.25 && gn < 0.4;
}

function meanAndStd(
  arr: Float64Array,
  start: number,
  length: number,
): { mean: number; std: number } {
  let sum = 0;
  for (let i = start; i < start + length; i++) {
    sum += arr[i];
  }
  const mean = sum / length;
  let variance = 0;
  for (let i = start; i < start + length; i++) {
    const d = arr[i] - mean;
    variance += d * d;
  }
  return { mean, std: Math.sqrt(variance / length) };
}

export class RppgDetector {
  private bufferR = new RingBuffer(SIGNAL_BUFFER_SIZE);
  private bufferG = new RingBuffer(SIGNAL_BUFFER_SIZE);
  private bufferB = new RingBuffer(SIGNAL_BUFFER_SIZE);
  private sampleCanvas: OffscreenCanvas;
  private sampleCtx: OffscreenCanvasRenderingContext2D;
  private beamformer = new SpatialBeamformer(PIXEL_COUNT, CORR_HISTORY);
  private lastBpm = 0;

  constructor() {
    this.sampleCanvas = new OffscreenCanvas(ROI_SAMPLE_SIZE, ROI_SAMPLE_SIZE);
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  sampleFrame(video: HTMLVideoElement, rois: ROI[]): void {
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let totalW = 0;

    for (let ri = 0; ri < rois.length; ri++) {
      const roi = rois[ri];
      this.sampleCtx.drawImage(
        video,
        roi.x,
        roi.y,
        roi.width,
        roi.height,
        0,
        0,
        this.sampleCanvas.width,
        this.sampleCanvas.height,
      );

      const { data } = this.sampleCtx.getImageData(
        0,
        0,
        this.sampleCanvas.width,
        this.sampleCanvas.height,
      );

      if (ri === 0) this.beamformer.record(data);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (!isSkinPixel(r, g, b)) continue;
        const w = this.beamformer.weight(i >> 2);
        totalR += r * w;
        totalG += g * w;
        totalB += b * w;
        totalW += w;
      }
    }

    if (totalW > 0) {
      this.bufferR.push(totalR / totalW);
      this.bufferG.push(totalG / totalW);
      this.bufferB.push(totalB / totalW);
    }
  }

  private computePosPulse(): Float64Array {
    const rArr = this.bufferR.toArray();
    const gArr = this.bufferG.toArray();
    const bArr = this.bufferB.toArray();
    const len = rArr.length;
    const pulse = new Float64Array(len);

    for (let start = 0; start <= len - POS_WINDOW; start++) {
      let rMean = 0,
        gMean = 0,
        bMean = 0;
      for (let j = 0; j < POS_WINDOW; j++) {
        rMean += rArr[start + j];
        gMean += gArr[start + j];
        bMean += bArr[start + j];
      }
      rMean /= POS_WINDOW;
      gMean /= POS_WINDOW;
      bMean /= POS_WINDOW;

      if (rMean < 1 || gMean < 1 || bMean < 1) continue;

      const s1 = new Float64Array(POS_WINDOW);
      const s2 = new Float64Array(POS_WINDOW);

      for (let j = 0; j < POS_WINDOW; j++) {
        const idx = start + j;
        const rn = rArr[idx] / rMean;
        const gn = gArr[idx] / gMean;
        const bn = bArr[idx] / bMean;
        s1[j] = gn - bn;
        s2[j] = gn + bn - 2 * rn;
      }

      const s1Stats = meanAndStd(s1, 0, POS_WINDOW);
      const s2Stats = meanAndStd(s2, 0, POS_WINDOW);
      const alpha = s2Stats.std > 1e-10 ? s1Stats.std / s2Stats.std : 0;

      for (let j = 0; j < POS_WINDOW; j++) {
        const h = s1[j] + alpha * s2[j];
        pulse[start + j] += (h - s1Stats.mean) / Math.max(s1Stats.std, 1e-10) / POS_WINDOW;
      }
    }

    return pulse;
  }

  computeBpm(sampleRate: number): RppgResult | null {
    if (this.bufferG.length < MIN_SAMPLES) return null;

    if (this.lastBpm > 0) {
      this.beamformer.correlate(this.lastBpm, sampleRate);
    }

    const posPulse = this.computePosPulse();
    const detrended = detrend(posPulse);
    const filtered = bandpassFilter(detrended, sampleRate, BPM_FREQ_MIN, BPM_FREQ_MAX);

    const fftResult = this.estimateByFFT(filtered, sampleRate);
    const acResult = this.estimateByAutocorrelation(filtered, sampleRate);

    let rawBpm: number;
    let confidence: number;

    if (fftResult && acResult) {
      const fftBpm = fftResult.frequency * 60;
      const acBpm = acResult.frequency * 60;
      const agree = Math.abs(fftBpm - acBpm) / Math.max(fftBpm, acBpm) < 0.1;
      if (agree) {
        rawBpm = (fftBpm + acBpm) / 2;
        confidence = Math.max(fftResult.confidence, acResult.confidence);
      } else if (acResult.confidence > fftResult.confidence) {
        rawBpm = acBpm;
        confidence = acResult.confidence;
      } else {
        rawBpm = fftBpm;
        confidence = fftResult.confidence;
      }
    } else if (acResult) {
      rawBpm = acResult.frequency * 60;
      confidence = acResult.confidence;
    } else if (fftResult) {
      rawBpm = fftResult.frequency * 60;
      confidence = fftResult.confidence;
    } else {
      return null;
    }

    if (confidence < MIN_CONFIDENCE) return null;
    if (rawBpm < BPM_MIN || rawBpm > BPM_MAX) return null;

    this.lastBpm = rawBpm;

    return {
      rawBpm,
      confidence,
      signal: detrended,
      filteredSignal: filtered,
    };
  }

  private estimateByFFT(
    filtered: Float64Array,
    sampleRate: number,
  ): { frequency: number; confidence: number } | null {
    const windowed = hammingWindow(filtered);
    const n = nextPowerOf2(windowed.length);
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    re.set(windowed);

    fft(re, im);
    const spectrum = magnitudeSpectrum(re, im);

    const peak = findDominantPeak(spectrum, sampleRate, BPM_FREQ_MIN, BPM_FREQ_MAX);
    if (!peak) return null;
    return { frequency: peak.frequency, confidence: peak.confidence };
  }

  private estimateByAutocorrelation(
    filtered: Float64Array,
    sampleRate: number,
  ): { frequency: number; confidence: number } | null {
    return autocorrelationPeak(filtered, sampleRate, BPM_FREQ_MIN, BPM_FREQ_MAX);
  }

  reset(): void {
    this.bufferR.clear();
    this.bufferG.clear();
    this.bufferB.clear();
    this.beamformer.reset();
    this.lastBpm = 0;
  }
}
