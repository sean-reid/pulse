<script lang="ts">
  import type { CheckResult } from '../modes/check';

  interface Props {
    result: CheckResult;
    onClose: () => void;
    onRetry: () => void;
  }

  let { result, onClose, onRetry }: Props = $props();

  const classColors = {
    relaxed: {
      bg: 'bg-success-green/10',
      border: 'border-success-green/20',
      text: 'text-success-green',
      label: 'Relaxed',
    },
    moderate: {
      bg: 'bg-warning-amber/10',
      border: 'border-warning-amber/20',
      text: 'text-warning-amber',
      label: 'Moderate',
    },
    elevated: {
      bg: 'bg-pulse-red/10',
      border: 'border-pulse-red/20',
      text: 'text-pulse-red',
      label: 'Elevated',
    },
  };

  let cls = $derived(classColors[result.classification]);
</script>

<div
  class="fixed inset-0 flex items-end sm:items-center justify-center z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
>
  <div
    class="w-full max-w-sm mx-4 mb-4 sm:mb-0 p-6 rounded-3xl bg-bg-primary/95 backdrop-blur-xl border border-white/10 shadow-2xl animate-slide-up"
  >
    <div class="flex flex-col gap-5">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-text-primary">Results</h2>
        <button
          onclick={onClose}
          aria-label="Close"
          class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
        >
          <svg
            class="w-4 h-4 text-text-secondary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Classification badge -->
      <div class="flex justify-center">
        <div class="py-2 px-5 rounded-full {cls.bg} {cls.border} border">
          <span class="{cls.text} font-semibold text-lg">{cls.label}</span>
        </div>
      </div>

      <!-- Stats grid -->
      <div class="grid grid-cols-2 gap-3">
        <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <p class="text-text-secondary text-xs uppercase tracking-wider mb-1">Avg Heart Rate</p>
          <p class="text-2xl font-bold text-text-primary tabular-nums">
            {result.avgBpm} <span class="text-xs font-normal text-text-secondary">bpm</span>
          </p>
        </div>
        <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <p class="text-text-secondary text-xs uppercase tracking-wider mb-1">Variability</p>
          <p class="text-2xl font-bold text-text-primary tabular-nums">{result.bpmStdDev}</p>
        </div>
        {#if result.avgBreathingRate !== null}
          <div class="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] col-span-2">
            <p class="text-text-secondary text-xs uppercase tracking-wider mb-1">Breathing Rate</p>
            <p class="text-2xl font-bold text-text-primary tabular-nums">
              {result.avgBreathingRate}
              <span class="text-xs font-normal text-text-secondary">br/min</span>
            </p>
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex gap-3">
        <button
          onclick={onRetry}
          class="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-text-primary font-medium text-sm cursor-pointer transition-colors"
        >
          Try Again
        </button>
        <button
          onclick={onClose}
          class="flex-1 py-3 rounded-xl bg-pulse-red/15 hover:bg-pulse-red/25 text-pulse-red font-medium text-sm cursor-pointer transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-slide-up {
    animation: slide-up 0.3s ease-out;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
</style>
