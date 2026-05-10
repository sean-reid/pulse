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

    const posPulse = this.computePosPulse();
    const detrended = detrend(posPulse);
    const filtered = bandpassFilter(detrended, sampleRate, BPM_FREQ_MIN, BPM_FREQ_MAX);
    const windowed = hammingWindow(filtered);

    const n = nextPowerOf2(windowed.length);
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    re.set(windowed);

    fft(re, im);
    const spectrum = magnitudeSpectrum(re, im);

    const peak = findDominantPeak(spectrum, sampleRate, BPM_FREQ_MIN, BPM_FREQ_MAX);
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
