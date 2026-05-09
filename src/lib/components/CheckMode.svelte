<script lang="ts">
  import { appState } from '../stores/app-state.svelte';
  import { StressCheck, type CheckResult } from '../modes/check';
  import StressReport from './StressReport.svelte';

  let check: StressCheck | null = null;
  let result = $state<CheckResult | null>(null);
  let visible = $derived(appState.mode === 'check' && appState.cameraActive);

  $effect(() => {
    if (visible && !result) {
      startCheck();
    } else if (!visible) {
      stopCheck();
      result = null;
    }
    return () => stopCheck();
  });

  function startCheck() {
    result = null;
    appState.checkTimeRemaining = 60;
    appState.checkActive = true;

    check = new StressCheck(
      60,
      () => appState.bpm,
      () => appState.breathingRate,
      (remaining) => {
        appState.checkTimeRemaining = remaining;
      },
      (r) => {
        result = r;
        appState.checkActive = false;
      },
    );
    check.start();
  }

  function stopCheck() {
    check?.stop();
    check = null;
    appState.checkActive = false;
  }

  function handleRetry() {
    result = null;
    startCheck();
  }

  function handleClose() {
    result = null;
    appState.mode = 'live';
  }

  let progress = $derived(1 - appState.checkTimeRemaining / 60);
  let circumference = 2 * Math.PI * 54;
</script>

{#if visible && !result}
  <div class="flex flex-col items-center gap-3">
    <div class="relative w-28 h-28">
      <svg class="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          stroke-width="3"
        />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="var(--color-accent)"
          stroke-width="3"
          stroke-dasharray={circumference}
          stroke-dashoffset={circumference * (1 - progress)}
          stroke-linecap="round"
          class="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-3xl font-semibold text-text-primary tabular-nums"
          >{appState.checkTimeRemaining}</span
        >
      </div>
    </div>
    <p class="text-text-secondary text-xs">Sit still and breathe normally</p>
  </div>
{/if}

{#if result}
  <StressReport {result} onClose={handleClose} onRetry={handleRetry} />
{/if}
