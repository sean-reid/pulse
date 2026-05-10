export class RingBuffer {
  private data: Float64Array;
  private head = 0;
  private _length = 0;

  constructor(private capacity: number) {
    this.data = new Float64Array(capacity);
  }

  push(value: number): void {
    this.data[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this._length < this.capacity) this._length++;
  }

  get length(): number {
    return this._length;
  }

  toArray(): Float64Array {
    const result = new Float64Array(this._length);
    for (let i = 0; i < this._length; i++) {
      const idx = (this.head - this._length + i + this.capacity) % this.capacity;
      result[i] = this.data[idx];
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this._length = 0;
  }
}

export function detrend(signal: Float64Array, windowSize = 60): Float64Array {
  const n = signal.length;
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - Math.floor(windowSize / 2));
    const hi = Math.min(n, i + Math.ceil(windowSize / 2));
    let sum = 0;
    for (let j = lo; j < hi; j++) sum += signal[j];
    result[i] = signal[i] - sum / (hi - lo);
  }
  return result;
}

export function hammingWindow(signal: Float64Array): Float64Array {
  const n = signal.length;
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = signal[i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return result;
}

export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1) return;

  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < halfLen; k++) {
        const evenIdx = i + k;
        const oddIdx = i + k + halfLen;
        const tRe = curRe * re[oddIdx] - curIm * im[oddIdx];
        const tIm = curRe * im[oddIdx] + curIm * re[oddIdx];
        re[oddIdx] = re[evenIdx] - tRe;
        im[oddIdx] = im[evenIdx] - tIm;
        re[evenIdx] += tRe;
        im[evenIdx] += tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

export function magnitudeSpectrum(re: Float64Array, im: Float64Array): Float64Array {
  const n = re.length;
  const mag = new Float64Array(n >> 1);
  for (let i = 0; i < mag.length; i++) {
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }
  return mag;
}

export function findDominantPeak(
  spectrum: Float64Array,
  sampleRate: number,
  minFreq: number,
  maxFreq: number,
): { frequency: number; magnitude: number; confidence: number } | null {
  const n = spectrum.length * 2;
  const freqResolution = sampleRate / n;
  const minBin = Math.ceil(minFreq / freqResolution);
  const maxBin = Math.floor(maxFreq / freqResolution);

  if (minBin >= spectrum.length || maxBin < 0) return null;

  const lo = Math.max(0, minBin);
  const hi = Math.min(spectrum.length - 1, maxBin);

  let peakBin = lo;
  let peakMag = spectrum[lo];
  let totalPower = 0;

  for (let i = lo; i <= hi; i++) {
    totalPower += spectrum[i] * spectrum[i];
    if (spectrum[i] > peakMag) {
      peakMag = spectrum[i];
      peakBin = i;
    }
  }

  if (peakMag < 1e-10) return null;

  // Noise floor rejection: reject if peak power < 2x median spectral power in passband
  const bandSize = hi - lo + 1;
  const bandValues = new Float64Array(bandSize);
  for (let i = 0; i < bandSize; i++) {
    bandValues[i] = spectrum[lo + i];
  }
  const sorted = new Float64Array(bandValues);
  sorted.sort();
  const median =
    bandSize % 2 === 1
      ? sorted[Math.floor(bandSize / 2)]
      : (sorted[bandSize / 2 - 1] + sorted[bandSize / 2]) / 2;
  if (peakMag < 2 * median) return null;

  let refinedBin = peakBin;
  if (peakBin > lo && peakBin < hi) {
    const alpha = spectrum[peakBin - 1];
    const beta = spectrum[peakBin];
    const gamma = spectrum[peakBin + 1];
    const denom = alpha - 2 * beta + gamma;
    if (Math.abs(denom) > 1e-10) {
      refinedBin = peakBin + (0.5 * (alpha - gamma)) / denom;
    }
  }

  const peakPower = peakMag * peakMag;
  const confidence = totalPower > 0 ? peakPower / totalPower : 0;

  return {
    frequency: refinedBin * freqResolution,
    magnitude: peakMag,
    confidence,
  };
}

export function bandpassFilter(
  signal: Float64Array,
  sampleRate: number,
  lowFreq: number,
  highFreq: number,
): Float64Array {
  const n = nextPowerOf2(signal.length);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(signal);

  fft(re, im);

  const freqRes = sampleRate / n;
  for (let i = 0; i < n; i++) {
    const freq = i <= n / 2 ? i * freqRes : (n - i) * freqRes;
    if (freq < lowFreq || freq > highFreq) {
      re[i] = 0;
      im[i] = 0;
    }
  }

  for (let i = 0; i < n; i++) im[i] = -im[i];
  fft(re, im);
  for (let i = 0; i < n; i++) im[i] = -im[i];

  const result = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    result[i] = re[i] / n;
  }
  return result;
}

export function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export function autocorrelationPeak(
  signal: Float64Array,
  sampleRate: number,
  minFreq: number,
  maxFreq: number,
): { frequency: number; confidence: number } | null {
  const n = signal.length;
  const minLag = Math.max(1, Math.floor(sampleRate / maxFreq));
  const maxLag = Math.min(n - 1, Math.ceil(sampleRate / minFreq));
  if (maxLag <= minLag) return null;

  let energy = 0;
  for (let i = 0; i < n; i++) energy += signal[i] * signal[i];
  if (energy < 1e-10) return null;

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < n - lag; i++) {
      corr += signal[i] * signal[i + lag];
    }
    corr /= energy;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestCorr <= 0) return null;

  let refined = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    let prev = 0;
    let next = 0;
    for (let i = 0; i < n - bestLag - 1; i++) {
      prev += signal[i] * signal[i + bestLag - 1];
      next += signal[i] * signal[i + bestLag + 1];
    }
    prev /= energy;
    next /= energy;
    const d = prev - 2 * bestCorr + next;
    if (Math.abs(d) > 1e-10) {
      refined = bestLag + (0.5 * (prev - next)) / d;
    }
  }

  return { frequency: sampleRate / refined, confidence: bestCorr };
}

export function findPeaks(signal: Float64Array, minDistance: number): number[] {
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < signal.length; i++) {
    sum += signal[i];
    sumSq += signal[i] * signal[i];
  }
  const mean = sum / signal.length;
  const std = Math.sqrt(Math.max(0, sumSq / signal.length - mean * mean));
  const threshold = mean + 0.3 * std;

  const peaks: number[] = [];
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1] && signal[i] > threshold) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        const a = signal[i - 1];
        const b = signal[i];
        const c = signal[i + 1];
        const denom = a - 2 * b + c;
        const offset = Math.abs(denom) > 1e-10 ? (0.5 * (a - c)) / denom : 0;
        peaks.push(i + (Math.abs(offset) < 0.5 ? offset : 0));
      }
    }
  }
  return peaks;
}

export function linearInterpolate(x: number[], y: number[], xNew: Float64Array): Float64Array {
  const result = new Float64Array(xNew.length);
  let j = 0;
  for (let i = 0; i < xNew.length; i++) {
    while (j < x.length - 2 && x[j + 1] < xNew[i]) j++;
    if (j >= x.length - 1) {
      result[i] = y[y.length - 1];
      continue;
    }
    const span = x[j + 1] - x[j];
    const t = span > 0 ? (xNew[i] - x[j]) / span : 0;
    result[i] = y[j] + t * (y[j + 1] - y[j]);
  }
  return result;
}
