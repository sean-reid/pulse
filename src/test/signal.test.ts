import { describe, it, expect } from 'vitest';
import {
  RingBuffer,
  detrend,
  hammingWindow,
  fft,
  magnitudeSpectrum,
  findDominantPeak,
  bandpassFilter,
  nextPowerOf2,
} from '../lib/detection/signal';

describe('RingBuffer', () => {
  it('stores and retrieves values in order', () => {
    const buf = new RingBuffer(4);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.length).toBe(3);
    expect(Array.from(buf.toArray())).toEqual([1, 2, 3]);
  });

  it('wraps around when full', () => {
    const buf = new RingBuffer(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    expect(buf.length).toBe(3);
    expect(Array.from(buf.toArray())).toEqual([2, 3, 4]);
  });

  it('clears correctly', () => {
    const buf = new RingBuffer(4);
    buf.push(1);
    buf.push(2);
    buf.clear();
    expect(buf.length).toBe(0);
    expect(Array.from(buf.toArray())).toEqual([]);
  });
});

describe('detrend', () => {
  it('removes slow drift via moving-average subtraction', () => {
    // Short signal: window (60) exceeds length, so moving average = global mean
    const signal = new Float64Array([1, 2, 3, 4, 5]);
    const result = detrend(signal);
    // Mean is 3, so result should be [-2, -1, 0, 1, 2]
    expect(result[0]).toBeCloseTo(-2, 10);
    expect(result[1]).toBeCloseTo(-1, 10);
    expect(result[2]).toBeCloseTo(0, 10);
    expect(result[3]).toBeCloseTo(1, 10);
    expect(result[4]).toBeCloseTo(2, 10);
  });

  it('removes DC offset', () => {
    const signal = new Float64Array([10, 10, 10, 10]);
    const result = detrend(signal);
    for (const val of result) {
      expect(Math.abs(val)).toBeLessThan(1e-10);
    }
  });

  it('removes local trend on longer signals', () => {
    // Create a signal with a slow nonlinear drift + a fast oscillation
    const n = 256;
    const signal = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      // slow drift (period >> window) + fast oscillation
      signal[i] = 50 * Math.sin((2 * Math.PI * i) / 300) + Math.sin((2 * Math.PI * 5 * i) / n);
    }
    const result = detrend(signal);
    // The mean of the detrended signal should be near zero
    let sum = 0;
    for (let i = 0; i < n; i++) sum += result[i];
    expect(Math.abs(sum / n)).toBeLessThan(1);
  });
});

describe('hammingWindow', () => {
  it('produces zero at endpoints', () => {
    const signal = new Float64Array([1, 1, 1, 1, 1]);
    const windowed = hammingWindow(signal);
    expect(windowed[0]).toBeCloseTo(0.08, 1);
    expect(windowed[4]).toBeCloseTo(0.08, 1);
  });

  it('is maximal at center', () => {
    const signal = new Float64Array([1, 1, 1, 1, 1]);
    const windowed = hammingWindow(signal);
    expect(windowed[2]).toBeCloseTo(1.0, 1);
  });
});

describe('FFT', () => {
  it('detects a single frequency correctly', () => {
    const n = 256;
    const sampleRate = 30;
    const targetFreq = 1.5;
    const re = new Float64Array(n);
    const im = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      re[i] = Math.sin((2 * Math.PI * targetFreq * i) / sampleRate);
    }

    fft(re, im);
    const mag = magnitudeSpectrum(re, im);

    let peakBin = 0;
    let peakVal = 0;
    for (let i = 1; i < mag.length; i++) {
      if (mag[i] > peakVal) {
        peakVal = mag[i];
        peakBin = i;
      }
    }

    const peakFreq = (peakBin * sampleRate) / n;
    expect(peakFreq).toBeCloseTo(targetFreq, 0);
  });

  it('handles power-of-2 lengths', () => {
    for (const len of [4, 8, 16, 32, 64]) {
      const re = new Float64Array(len);
      const im = new Float64Array(len);
      re[1] = 1;
      expect(() => fft(re, im)).not.toThrow();
    }
  });
});

describe('findDominantPeak', () => {
  it('finds peak in the correct frequency band', () => {
    const n = 256;
    const sampleRate = 30;
    const targetFreq = 1.2;

    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      re[i] = Math.sin((2 * Math.PI * targetFreq * i) / sampleRate);
    }

    fft(re, im);
    const mag = magnitudeSpectrum(re, im);

    const result = findDominantPeak(mag, sampleRate, 0.7, 4.0);
    expect(result).not.toBeNull();
    expect(result!.frequency).toBeCloseTo(targetFreq, 0);
    expect(result!.confidence).toBeGreaterThan(0.1);
  });

  it('returns null when no signal in band', () => {
    const n = 256;
    const mag = new Float64Array(n / 2);
    const result = findDominantPeak(mag, 30, 0.7, 4.0);
    expect(result).toBeNull();
  });
});

describe('bandpassFilter', () => {
  it('passes in-band frequencies', () => {
    const n = 256;
    const sampleRate = 30;
    const inBandFreq = 1.5;

    const signal = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      signal[i] = Math.sin((2 * Math.PI * inBandFreq * i) / sampleRate);
    }

    const filtered = bandpassFilter(signal, sampleRate, 0.7, 4.0);
    const energy = filtered.reduce((sum, v) => sum + v * v, 0);
    expect(energy).toBeGreaterThan(0.1);
  });

  it('rejects out-of-band frequencies', () => {
    const n = 256;
    const sampleRate = 30;
    const outBandFreq = 10;

    const signal = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      signal[i] = Math.sin((2 * Math.PI * outBandFreq * i) / sampleRate);
    }

    const filtered = bandpassFilter(signal, sampleRate, 0.7, 4.0);
    const energy = filtered.reduce((sum, v) => sum + v * v, 0);
    const origEnergy = signal.reduce((sum, v) => sum + v * v, 0);
    expect(energy / origEnergy).toBeLessThan(0.01);
  });
});

describe('nextPowerOf2', () => {
  it('returns correct values', () => {
    expect(nextPowerOf2(1)).toBe(1);
    expect(nextPowerOf2(3)).toBe(4);
    expect(nextPowerOf2(5)).toBe(8);
    expect(nextPowerOf2(128)).toBe(128);
    expect(nextPowerOf2(200)).toBe(256);
  });
});
