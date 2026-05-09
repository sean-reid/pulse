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
  SIGNAL_BUFFER_SIZE,
  BREATH_FREQ_MIN,
  BREATH_FREQ_MAX,
  BREATH_MIN,
  BREATH_MAX,
  CAMERA_FPS,
  ROI_SAMPLE_SIZE,
} from '../utils/constants';

export interface BreathResult {
  rate: number;
  confidence: number;
}

const MIN_SAMPLES = 150;
const MIN_CONFIDENCE = 0.06;

export class BreathingDetector {
  private buffer = new RingBuffer(SIGNAL_BUFFER_SIZE);
  private sampleCanvas: OffscreenCanvas;
  private sampleCtx: OffscreenCanvasRenderingContext2D;
  private prevPixels: Uint8ClampedArray | null = null;
  private smoothedRate: number | null = null;

  constructor() {
    this.sampleCanvas = new OffscreenCanvas(ROI_SAMPLE_SIZE, ROI_SAMPLE_SIZE);
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  sampleFrame(video: HTMLVideoElement, chestROI: ROI): void {
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
      this.buffer.push(Math.sqrt(motionEnergy));
    }

    this.prevPixels = new Uint8ClampedArray(pixels);
  }

  computeBreathingRate(): BreathResult | null {
    if (this.buffer.length < MIN_SAMPLES) return null;

    const raw = this.buffer.toArray();
    const detrended = detrend(raw);
    const filtered = bandpassFilter(detrended, CAMERA_FPS, BREATH_FREQ_MIN, BREATH_FREQ_MAX);
    const windowed = hammingWindow(filtered);

    const n = nextPowerOf2(windowed.length);
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    re.set(windowed);

    fft(re, im);
    const spectrum = magnitudeSpectrum(re, im);

    const peak = findDominantPeak(spectrum, CAMERA_FPS, BREATH_FREQ_MIN, BREATH_FREQ_MAX);
    if (!peak || peak.confidence < MIN_CONFIDENCE) return null;

    const rawRate = peak.frequency * 60;
    if (rawRate < BREATH_MIN || rawRate > BREATH_MAX) return null;

    if (this.smoothedRate === null) {
      this.smoothedRate = rawRate;
    } else {
      this.smoothedRate = this.smoothedRate * 0.7 + rawRate * 0.3;
    }

    return {
      rate: Math.round(this.smoothedRate),
      confidence: peak.confidence,
    };
  }

  reset(): void {
    this.buffer.clear();
    this.prevPixels = null;
    this.smoothedRate = null;
  }
}
