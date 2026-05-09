import type { BreathPattern } from '../stores/app-state.svelte';

export interface BreathPhase {
  type: 'inhale' | 'hold' | 'exhale';
  duration: number;
}

export interface BreathPatternConfig {
  name: string;
  phases: BreathPhase[];
  description: string;
}

export const BREATH_PATTERNS: Record<BreathPattern, BreathPatternConfig> = {
  '4-7-8': {
    name: '4-7-8 Calm',
    description: 'Inhale 4s, hold 7s, exhale 8s',
    phases: [
      { type: 'inhale', duration: 4 },
      { type: 'hold', duration: 7 },
      { type: 'exhale', duration: 8 },
    ],
  },
  box: {
    name: 'Box Breathing',
    description: 'Equal 4s phases',
    phases: [
      { type: 'inhale', duration: 4 },
      { type: 'hold', duration: 4 },
      { type: 'exhale', duration: 4 },
      { type: 'hold', duration: 4 },
    ],
  },
  coherence: {
    name: 'Coherence',
    description: 'Equal inhale and exhale, 5s each',
    phases: [
      { type: 'inhale', duration: 5 },
      { type: 'exhale', duration: 5 },
    ],
  },
};

export class BreathTimer {
  private startTime = 0;
  private running = false;
  private pattern: BreathPatternConfig;
  private onPhaseChange: (phase: 'inhale' | 'hold' | 'exhale', progress: number) => void;
  private onCycleComplete: () => void;
  private animFrameId = 0;

  constructor(
    patternKey: BreathPattern,
    onPhaseChange: (phase: 'inhale' | 'hold' | 'exhale', progress: number) => void,
    onCycleComplete: () => void,
  ) {
    this.pattern = BREATH_PATTERNS[patternKey];
    this.onPhaseChange = onPhaseChange;
    this.onCycleComplete = onCycleComplete;
  }

  private get cycleDuration(): number {
    return this.pattern.phases.reduce((sum, p) => sum + p.duration, 0);
  }

  start(): void {
    this.startTime = performance.now();
    this.running = true;
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  private tick = (): void => {
    if (!this.running) return;
    this.animFrameId = requestAnimationFrame(this.tick);

    const elapsed = (performance.now() - this.startTime) / 1000;
    const cycleTime = elapsed % this.cycleDuration;

    if (elapsed > 0 && cycleTime < 0.05 && elapsed > this.cycleDuration * 0.5) {
      this.onCycleComplete();
    }

    let accumulated = 0;
    for (const phase of this.pattern.phases) {
      if (cycleTime < accumulated + phase.duration) {
        const phaseProgress = (cycleTime - accumulated) / phase.duration;
        this.onPhaseChange(phase.type, phaseProgress);
        return;
      }
      accumulated += phase.duration;
    }
  };

  updatePattern(patternKey: BreathPattern): void {
    this.pattern = BREATH_PATTERNS[patternKey];
    this.startTime = performance.now();
  }
}
