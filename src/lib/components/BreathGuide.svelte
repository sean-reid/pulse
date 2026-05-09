<script lang="ts">
  import { appState } from '../stores/app-state.svelte';
  import { BreathTimer, BREATH_PATTERNS } from '../modes/breathe';
  import type { BreathPattern } from '../stores/app-state.svelte';

  let timer: BreathTimer | null = null;
  let scale = $state(0.6);
  let phase = $state<'inhale' | 'hold' | 'exhale'>('inhale');
  let sessionStart = 0;
  let sessionInterval: ReturnType<typeof setInterval> | null = null;

  const phaseLabels = { inhale: 'Breathe in', hold: 'Hold', exhale: 'Breathe out' };
  const patterns = Object.entries(BREATH_PATTERNS) as [
    BreathPattern,
    (typeof BREATH_PATTERNS)[BreathPattern],
  ][];

  let visible = $derived(appState.mode === 'breathe' && appState.cameraActive);

  $effect(() => {
    if (visible) {
      startTimer();
      sessionStart = Date.now();
      sessionInterval = setInterval(() => {
        appState.sessionTime = Math.floor((Date.now() - sessionStart) / 1000);
      }, 1000);
    } else {
      stopTimer();
      if (sessionInterval) {
        clearInterval(sessionInterval);
        sessionInterval = null;
      }
    }

    return () => {
      stopTimer();
      if (sessionInterval) clearInterval(sessionInterval);
    };
  });

  function startTimer() {
    stopTimer();
    timer = new BreathTimer(
      appState.breathPattern,
      (p, progress) => {
        phase = p;
        if (p === 'inhale') {
          scale = 0.6 + progress * 0.4;
        } else if (p === 'exhale') {
          scale = 1.0 - progress * 0.4;
        }
      },
      () => {},
    );
    timer.start();
  }

  function stopTimer() {
    timer?.stop();
    timer = null;
  }

  function selectPattern(key: BreathPattern) {
    appState.breathPattern = key;
    if (timer) {
      timer.updatePattern(key);
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
</script>

{#if visible}
  <div class="flex flex-col items-center gap-5 w-full">
    <div class="flex items-center gap-1">
      {#each patterns as [key, config] (key)}
        <button
          onclick={() => selectPattern(key)}
          class="py-1.5 px-3 rounded-md text-xs cursor-pointer transition-colors
                 {appState.breathPattern === key
            ? 'bg-blue-muted text-blue'
            : 'text-text-secondary hover:text-text-primary'}"
        >
          {config.name}
        </button>
      {/each}
    </div>

    <div class="relative flex items-center justify-center">
      <div
        class="w-32 h-32 rounded-full border border-blue/30 flex items-center justify-center
               transition-transform duration-500 ease-out sm:w-40 sm:h-40"
        style="transform: scale({scale})"
      >
        <span class="text-blue text-sm">{phaseLabels[phase]}</span>
      </div>
    </div>

    <span class="text-text-tertiary text-xs tabular-nums">{formatTime(appState.sessionTime)}</span>
  </div>
{/if}
