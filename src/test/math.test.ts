import { describe, it, expect } from 'vitest';
import { clamp, lerp, iirCoefficient, linearRegression } from '../lib/utils/math';

describe('clamp', () => {
  it('clamps below minimum', () => expect(clamp(-5, 0, 10)).toBe(0));
  it('clamps above maximum', () => expect(clamp(15, 0, 10)).toBe(10));
  it('passes through in-range values', () => expect(clamp(5, 0, 10)).toBe(5));
});

describe('lerp', () => {
  it('returns a at t=0', () => expect(lerp(10, 20, 0)).toBe(10));
  it('returns b at t=1', () => expect(lerp(10, 20, 1)).toBe(20));
  it('returns midpoint at t=0.5', () => expect(lerp(10, 20, 0.5)).toBe(15));
});

describe('iirCoefficient', () => {
  it('returns reasonable values for typical frequencies', () => {
    const alpha = iirCoefficient(1.0, 30);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
  });

  it('higher cutoff gives larger coefficient', () => {
    const low = iirCoefficient(0.5, 30);
    const high = iirCoefficient(5.0, 30);
    expect(high).toBeGreaterThan(low);
  });
});

describe('linearRegression', () => {
  it('finds slope and intercept of a linear signal', () => {
    const y = new Float64Array([2, 4, 6, 8, 10]);
    const { slope, intercept } = linearRegression(y);
    expect(slope).toBeCloseTo(2.0, 5);
    expect(intercept).toBeCloseTo(2.0, 5);
  });

  it('handles constant signal', () => {
    const y = new Float64Array([5, 5, 5, 5]);
    const { slope, intercept } = linearRegression(y);
    expect(slope).toBeCloseTo(0, 5);
    expect(intercept).toBeCloseTo(5, 5);
  });
});
