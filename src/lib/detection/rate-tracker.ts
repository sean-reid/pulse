/**
 * 2D Kalman filter for real-time rate tracking (HR or breathing rate).
 *
 * State: [rate, rate_velocity]
 * Assumes a constant-velocity process model with Gaussian noise.
 * Each measurement source provides its own variance estimate,
 * so the filter naturally weights high-quality sources more heavily.
 * Innovation gating rejects outlier measurements.
 */

const GATE_THRESHOLD = 9; // 3-sigma squared

export class RateTracker {
  private x0: number;
  private x1: number;
  private p00: number;
  private p01: number;
  private p10: number;
  private p11: number;
  private q: number;
  private _initialized = false;

  constructor(processNoise: number) {
    this.q = processNoise;
    this.x0 = 0;
    this.x1 = 0;
    this.p00 = 1000;
    this.p01 = 0;
    this.p10 = 0;
    this.p11 = 1000;
  }

  predict(dt: number): void {
    if (!this._initialized) return;

    this.x0 += this.x1 * dt;

    const p00 = this.p00 + dt * (this.p10 + this.p01) + dt * dt * this.p11;
    const p01 = this.p01 + dt * this.p11;
    const p10 = this.p10 + dt * this.p11;
    const p11 = this.p11;

    const dt3 = (this.q * dt * dt * dt) / 3;
    const dt2 = (this.q * dt * dt) / 2;
    const dt1 = this.q * dt;

    this.p00 = p00 + dt3;
    this.p01 = p01 + dt2;
    this.p10 = p10 + dt2;
    this.p11 = p11 + dt1;
  }

  update(measurement: number, measurementVariance: number): boolean {
    if (!this._initialized) {
      this.x0 = measurement;
      this.x1 = 0;
      this.p00 = measurementVariance;
      this.p01 = 0;
      this.p10 = 0;
      this.p11 = 1;
      this._initialized = true;
      return true;
    }

    const innovation = measurement - this.x0;
    const innovationVar = this.p00 + measurementVariance;

    if ((innovation * innovation) / innovationVar > GATE_THRESHOLD) {
      return false;
    }

    const k0 = this.p00 / innovationVar;
    const k1 = this.p10 / innovationVar;

    this.x0 += k0 * innovation;
    this.x1 += k1 * innovation;

    const p00 = (1 - k0) * this.p00;
    const p01 = (1 - k0) * this.p01;
    const p10 = this.p10 - k1 * this.p00;
    const p11 = this.p11 - k1 * this.p01;

    this.p00 = p00;
    this.p01 = p01;
    this.p10 = p10;
    this.p11 = p11;

    return true;
  }

  get rate(): number {
    return this.x0;
  }

  get variance(): number {
    return this.p00;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  reset(): void {
    this.x0 = 0;
    this.x1 = 0;
    this.p00 = 1000;
    this.p01 = 0;
    this.p10 = 0;
    this.p11 = 1000;
    this._initialized = false;
  }
}
