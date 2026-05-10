import {
  RingBuffer,
  detrend,
  hammingWindow,
  bandpassFilter,
  fft,
  magnitudeSpectrum,
  findDominantPeak,
  nextPowerOf2,
} from './signal';
import type { ROI } from './rppg';
import {
  BREATH_FREQ_MIN,
  BREATH_FREQ_MAX,
  BREATH_MIN,
  BREATH_MAX,
  ROI_SAMPLE_SIZE,
} from '../utils/constants';

export interface BreathEstimate {
  rate: number;
  confidence: number;
  source: 'motion' | 'landmark';
}

const MOTION_BUFFER_SIZE = 900;
const LANDMARK_BUFFER_SIZE = 300;
const MIN_MOTION_SAMPLES = 240;
const MIN_LANDMARK_SAMPLES = 80;
const MIN_CONFIDENCE = 0.04;
const MOTION_DETREND_WINDOW = 150;
const LANDMARK_DETREND_WINDOW = 50;

export class BreathingDetector {
  private motionBuffer = new RingBuffer(MOTION_BUFFER_SIZE);
  private landmarkBuffer = new RingBuffer(LANDMARK_BUFFER_SIZE);
  private sampleCanvas: OffscreenCanvas;
  private sampleCtx: OffscreenCanvasRenderingContext2D;
  private prevPixels: Uint8ClampedArray | null = null;

  constructor() {
    this.sampleCanvas = new OffscreenCanvas(ROI_SAMPLE_SIZE, ROI_SAMPLE_SIZE);
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  sampleMotion(video: HTMLVideoElement, chestROI: ROI): void {
    const { sampleCtx, sampleCanvas } = this;

    if (chestROI.width <= 0 || chestROI.height <= 0) return;

    sampleCtx.drawImage(
      video,
      chestROI.x,
      chestROI.y,
      chestROI.width,
      chestROI.height,
      0,
      0,
      sampleCanvas.width,
      sampleCanvas.height,
    );

    const imageData = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
    const pixels = imageData.data;

    if (this.prevPixels) {
      let motionEnergy = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const dg = pixels[i + 1] - this.prevPixels[i + 1];
        motionEnergy += dg * dg;
      }
      motionEnergy /= pixels.length / 4;
      this.motionBuffer.push(Math.sqrt(motionEnergy));
    }

    this.prevPixels = new Uint8ClampedArray(pixels);
  }

  sampleLandmarks(breathLandmarkY: number): void {
    this.landmarkBuffer.push(breathLandmarkY);
  }

  private analyzeSignal(
    buffer: RingBuffer,
    minSamples: number,
    sampleRate: number,
    detrendWindow: number,
  ): { rate: number; confidence: number } | null {
    if (buffer.length < minSamples) return null;

    const raw = buffer.toArray();
    const detrended = detrend(raw, detrendWindow);
    const filtered = bandpassFilter(detrended, sampleRate, BREATH_FREQ_MIN, BREATH_FREQ_MAX);
    const windowed = hammingWindow(filtered);

    const n = nextPowerOf2(windowed.length * 4);
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    re.set(windowed);

    fft(re, im);
    const spectrum = magnitudeSpectrum(re, im);

    const peak = findDominantPeak(spectrum, sampleRate, BREATH_FREQ_MIN, BREATH_FREQ_MAX);
    if (!peak || peak.confidence < MIN_CONFIDENCE) return null;

    const rawRate = peak.frequency * 60;
    if (rawRate < BREATH_MIN || rawRate > BREATH_MAX) return null;

    return { rate: rawRate, confidence: peak.confidence };
  }

  getEstimates(sampleRate: number, landmarkSampleRate: number): BreathEstimate[] {
    const estimates: BreathEstimate[] = [];

    const motionResult = this.analyzeSignal(
      this.motionBuffer,
      MIN_MOTION_SAMPLES,
      sampleRate,
      MOTION_DETREND_WINDOW,
    );
    if (motionResult) {
      estimates.push({ ...motionResult, source: 'motion' });
    }

    const landmarkResult = this.analyzeSignal(
      this.landmarkBuffer,
      MIN_LANDMARK_SAMPLES,
      landmarkSampleRate,
      LANDMARK_DETREND_WINDOW,
    );
    if (landmarkResult) {
      estimates.push({ ...landmarkResult, source: 'landmark' });
    }

    return estimates;
  }

  getInstantaneousSignal(): number {
    if (this.landmarkBuffer.length < 20) return 0;
    const arr = this.landmarkBuffer.toArray();
    const len = arr.length;
    const window = Math.min(20, len);
    let mean = 0;
    for (let i = len - window; i < len; i++) mean += arr[i];
    mean /= window;
    return arr[len - 1] - mean;
  }

  reset(): void {
    this.motionBuffer.clear();
    this.landmarkBuffer.clear();
    this.prevPixels = null;
  }
}
