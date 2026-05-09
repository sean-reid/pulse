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
  <div class="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
    <!-- Pattern selector -->
    <div class="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto">
      <div
        class="flex items-center gap-1 p-1 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.08]"
      >
        {#each patterns as [key, config] (key)}
          <button
            onclick={() => selectPattern(key)}
            class="py-1.5 px-3 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer
                   {appState.breathPattern === key
              ? 'bg-breath-blue/20 text-breath-blue'
              : 'text-text-secondary hover:text-text-primary'}"
          >
            {config.name}
          </button>
        {/each}
      </div>
    </div>

    <!-- Breathing circle -->
    <div class="relative flex items-center justify-center">
      <div
        class="w-48 h-48 rounded-full border-2 border-breath-blue/30 flex items-center justify-center
               transition-transform duration-500 ease-out sm:w-56 sm:h-56"
        style="transform: scale({scale})"
      >
        <div
          class="w-40 h-40 rounded-full border border-breath-blue/15 flex items-center justify-center sm:w-48 sm:h-48"
        >
          <div class="flex flex-col items-center gap-1">
            <span class="text-breath-blue text-lg font-medium">{phaseLabels[phase]}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Session time -->
    <div class="absolute bottom-32 left-1/2 -translate-x-1/2">
      <span class="text-text-secondary text-sm tabular-nums"
        >{formatTime(appState.sessionTime)}</span
      >
    </div>
  </div>
{/if}
