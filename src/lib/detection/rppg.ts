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

export interface RppgResult {
  rawBpm: number;
  confidence: number;
  signal: Float64Array;
  filteredSignal: Float64Array;
}

const MIN_SAMPLES = 150;
const MIN_CONFIDENCE = 0.08;
const CHROM_WINDOW = 64;

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

  constructor() {
    this.sampleCanvas = new OffscreenCanvas(ROI_SAMPLE_SIZE, ROI_SAMPLE_SIZE);
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  sampleFrame(video: HTMLVideoElement, rois: ROI[]): void {
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
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
        if (isSkinPixel(r, g, b)) {
          totalR += r;
          totalG += g;
          totalB += b;
          totalCount++;
        }
      }
    }

    if (totalCount > 0) {
      this.bufferR.push(totalR / totalCount);
      this.bufferG.push(totalG / totalCount);
      this.bufferB.push(totalB / totalCount);
    }
  }

  private computeChromPulse(): Float64Array {
    const rArr = this.bufferR.toArray();
    const gArr = this.bufferG.toArray();
    const bArr = this.bufferB.toArray();
    const len = rArr.length;
    const pulse = new Float64Array(len);

    for (let start = 0; start <= len - CHROM_WINDOW; start++) {
      const rStats = meanAndStd(rArr, start, CHROM_WINDOW);
      const gStats = meanAndStd(gArr, start, CHROM_WINDOW);
      const bStats = meanAndStd(bArr, start, CHROM_WINDOW);

      const rStd = rStats.std > 1e-10 ? rStats.std : 1;
      const gStd = gStats.std > 1e-10 ? gStats.std : 1;
      const bStd = bStats.std > 1e-10 ? bStats.std : 1;

      const xs = new Float64Array(CHROM_WINDOW);
      const ys = new Float64Array(CHROM_WINDOW);

      for (let j = 0; j < CHROM_WINDOW; j++) {
        const idx = start + j;
        const rn = (rArr[idx] - rStats.mean) / rStd;
        const gn = (gArr[idx] - gStats.mean) / gStd;
        const bn = (bArr[idx] - bStats.mean) / bStd;
        xs[j] = 3 * rn - 2 * gn;
        ys[j] = 1.5 * rn + gn - 1.5 * bn;
      }

      const xsStats = meanAndStd(xs, 0, CHROM_WINDOW);
      const ysStats = meanAndStd(ys, 0, CHROM_WINDOW);
      const alpha = ysStats.std > 1e-10 ? xsStats.std / ysStats.std : 0;

      for (let j = 0; j < CHROM_WINDOW; j++) {
        pulse[start + j] += (xs[j] - alpha * ys[j]) / CHROM_WINDOW;
      }
    }

    return pulse;
  }

  computeBpm(): RppgResult | null {
    if (this.bufferG.length < MIN_SAMPLES) return null;

    const chromPulse = this.computeChromPulse();
    const detrended = detrend(chromPulse);
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

    return {
      rawBpm,
      confidence: peak.confidence,
      signal: detrended,
      filteredSignal: filtered,
    };
  }

  reset(): void {
    this.bufferR.clear();
    this.bufferG.clear();
    this.bufferB.clear();
  }
}
