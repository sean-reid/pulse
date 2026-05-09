export interface CheckResult {
  avgBpm: number;
  bpmStdDev: number;
  avgBreathingRate: number | null;
  classification: 'relaxed' | 'moderate' | 'elevated';
  duration: number;
  samples: number[];
}

export class StressCheck {
  private bpmSamples: number[] = [];
  private breathSamples: number[] = [];
  private startTime = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private onTick: (remaining: number) => void;
  private onComplete: (result: CheckResult) => void;
  private getBpm: () => number | null;
  private getBreathRate: () => number | null;
  private duration: number;

  constructor(
    duration: number,
    getBpm: () => number | null,
    getBreathRate: () => number | null,
    onTick: (remaining: number) => void,
    onComplete: (result: CheckResult) => void,
  ) {
    this.duration = duration;
    this.getBpm = getBpm;
    this.getBreathRate = getBreathRate;
    this.onTick = onTick;
    this.onComplete = onComplete;
  }

  start(): void {
    this.bpmSamples = [];
    this.breathSamples = [];
    this.startTime = Date.now();

    this.interval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const remaining = Math.max(0, this.duration - elapsed);
      this.onTick(Math.ceil(remaining));

      const bpm = this.getBpm();
      if (bpm !== null) this.bpmSamples.push(bpm);

      const breath = this.getBreathRate();
      if (breath !== null) this.breathSamples.push(breath);

      if (remaining <= 0) {
        this.complete();
      }
    }, 1000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private complete(): void {
    this.stop();

    const avgBpm =
      this.bpmSamples.length > 0
        ? this.bpmSamples.reduce((a, b) => a + b, 0) / this.bpmSamples.length
        : 0;

    const bpmStdDev =
      this.bpmSamples.length > 1
        ? Math.sqrt(
            this.bpmSamples.reduce((sum, v) => sum + (v - avgBpm) ** 2, 0) /
              (this.bpmSamples.length - 1),
          )
        : 0;

    const avgBreathingRate =
      this.breathSamples.length > 0
        ? this.breathSamples.reduce((a, b) => a + b, 0) / this.breathSamples.length
        : null;

    let classification: 'relaxed' | 'moderate' | 'elevated';
    if (avgBpm < 72 && bpmStdDev < 8) {
      classification = 'relaxed';
    } else if (avgBpm > 90 || bpmStdDev > 15) {
      classification = 'elevated';
    } else {
      classification = 'moderate';
    }

    this.onComplete({
      avgBpm: Math.round(avgBpm),
      bpmStdDev: Math.round(bpmStdDev * 10) / 10,
      avgBreathingRate: avgBreathingRate !== null ? Math.round(avgBreathingRate) : null,
      classification,
      duration: this.duration,
      samples: this.bpmSamples,
    });
  }
}
