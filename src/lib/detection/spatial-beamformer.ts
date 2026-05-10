const MIN_FRAMES = 30;
const WEIGHT_FLOOR = 0.1;

export class SpatialBeamformer {
  private readonly history: Float32Array;
  private readonly pixels: number;
  private readonly capacity: number;
  private head = 0;
  private len = 0;
  private weights: Float32Array | null = null;

  constructor(pixels: number, frames: number) {
    this.pixels = pixels;
    this.capacity = frames;
    this.history = new Float32Array(pixels * frames);
  }

  record(rgba: Uint8ClampedArray): void {
    for (let i = 0; i < this.pixels; i++) {
      this.history[i * this.capacity + this.head] = rgba[i * 4 + 1];
    }
    this.head = (this.head + 1) % this.capacity;
    if (this.len < this.capacity) this.len++;
  }

  correlate(bpm: number, sampleRate: number): void {
    if (this.len < MIN_FRAMES) return;

    const n = this.len;
    const omega = (2 * Math.PI * bpm) / (60 * sampleRate);

    const ref = new Float32Array(n);
    let refPower = 0;
    for (let t = 0; t < n; t++) {
      ref[t] = Math.sin(omega * t);
      refPower += ref[t] * ref[t];
    }

    const w = new Float32Array(this.pixels);
    const start = (this.head - n + this.capacity) % this.capacity;

    for (let p = 0; p < this.pixels; p++) {
      const base = p * this.capacity;

      let mean = 0;
      for (let t = 0; t < n; t++) {
        mean += this.history[base + ((start + t) % this.capacity)];
      }
      mean /= n;

      let dot = 0;
      let power = 0;
      for (let t = 0; t < n; t++) {
        const v = this.history[base + ((start + t) % this.capacity)] - mean;
        dot += v * ref[t];
        power += v * v;
      }

      const denom = Math.sqrt(power * refPower);
      const corr = denom > 1e-10 ? Math.max(0, dot / denom) : 0;
      w[p] = WEIGHT_FLOOR + (1 - WEIGHT_FLOOR) * corr;
    }

    this.weights = w;
  }

  weight(index: number): number {
    return this.weights ? this.weights[index] : 1;
  }

  get active(): boolean {
    return this.weights !== null;
  }

  reset(): void {
    this.head = 0;
    this.len = 0;
    this.weights = null;
  }
}
