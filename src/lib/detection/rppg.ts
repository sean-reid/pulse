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
import {
  SIGNAL_BUFFER_SIZE,
  BPM_FREQ_MIN,
  BPM_FREQ_MAX,
  BPM_MIN,
  BPM_MAX,
  CAMERA_FPS,
  ROI_SAMPLE_SIZE,
} from '../utils/constants';

export interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BpmResult {
  bpm: number;
  confidence: number;
  signal: Float64Array;
}

const MIN_SAMPLES = 150;
const MIN_CONFIDENCE = 0.08;

export class RppgDetector {
  private buffer = new RingBuffer(SIGNAL_BUFFER_SIZE);
  private sampleCanvas: OffscreenCanvas;
  private sampleCtx: OffscreenCanvasRenderingContext2D;
  private smoothedBpm: number | null = null;
  private frameCount = 0;

  constructor() {
    this.sampleCanvas = new OffscreenCanvas(ROI_SAMPLE_SIZE, ROI_SAMPLE_SIZE);
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  sampleFrame(video: HTMLVideoElement, rois: ROI[]): void {
    let totalGreen = 0;
    let totalCount = 0;

    for (const roi of rois) {
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

      const imageData = this.sampleCtx.getImageData(
        0,
        0,
        this.sampleCanvas.width,
        this.sampleCanvas.height,
      );
      const pixels = imageData.data;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        if (r > 40 && g > 40 && b > 20 && r < 250) {
          totalGreen += g;
          totalCount++;
        }
      }
    }

    if (totalCount > 0) {
      this.buffer.push(totalGreen / totalCount);
    }
    this.frameCount++;
  }

  computeBpm(): BpmResult | null {
    if (this.buffer.length < MIN_SAMPLES) return null;

    const raw = this.buffer.toArray();
    const detrended = detrend(raw);
    const filtered = bandpassFilter(detrended, CAMERA_FPS, BPM_FREQ_MIN, BPM_FREQ_MAX);
    const windowed = hammingWindow(filtered);

    const n = nextPowerOf2(windowed.length);
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    re.set(windowed);

    fft(re, im);
    const spectrum = magnitudeSpectrum(re, im);

    const peak = findDominantPeak(spectrum, CAMERA_FPS, BPM_FREQ_MIN, BPM_FREQ_MAX);
    if (!peak || peak.confidence < MIN_CONFIDENCE) return null;

    const rawBpm = peak.frequency * 60;
    if (rawBpm < BPM_MIN || rawBpm > BPM_MAX) return null;

    if (this.smoothedBpm === null) {
      this.smoothedBpm = rawBpm;
    } else {
      const alpha = peak.confidence > 0.2 ? 0.3 : 0.15;
      this.smoothedBpm = this.smoothedBpm * (1 - alpha) + rawBpm * alpha;
    }

    return {
      bpm: Math.round(this.smoothedBpm),
      confidence: peak.confidence,
      signal: detrended,
    };
  }

  getSignal(): Float64Array {
    return this.buffer.toArray();
  }

  get sampleCount(): number {
    return this.buffer.length;
  }

  reset(): void {
    this.buffer.clear();
    this.smoothedBpm = null;
    this.frameCount = 0;
  }
}
