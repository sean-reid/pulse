<script lang="ts">
  import type { CheckResult } from '../modes/check';

  interface Props {
    result: CheckResult;
    onClose: () => void;
    onRetry: () => void;
  }

  let { result, onClose, onRetry }: Props = $props();

  const classStyles = {
    relaxed: { color: 'text-green', label: 'Relaxed' },
    moderate: { color: 'text-amber', label: 'Moderate' },
    elevated: { color: 'text-accent', label: 'Elevated' },
  };

  let cls = $derived(classStyles[result.classification]);
</script>

<div class="fixed inset-0 flex items-end sm:items-center justify-center z-50 bg-black/60">
  <div
    class="w-full max-w-sm mx-4 mb-4 sm:mb-0 p-5 rounded-lg bg-bg-surface border border-border-default"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-text-primary">Results</h2>
        <button
          onclick={onClose}
          aria-label="Close"
          class="text-text-secondary hover:text-text-primary cursor-pointer text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <p class="text-center {cls.color} font-medium">{cls.label}</p>

      <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <p class="text-text-tertiary text-xs mb-0.5">Heart rate</p>
          <p class="text-text-primary tabular-nums">
            {result.avgBpm} <span class="text-text-secondary text-xs">bpm</span>
          </p>
        </div>
        <div>
          <p class="text-text-tertiary text-xs mb-0.5">Variability</p>
          <p class="text-text-primary tabular-nums">{result.bpmStdDev}</p>
        </div>
        {#if result.avgBreathingRate !== null}
          <div>
            <p class="text-text-tertiary text-xs mb-0.5">Breathing</p>
            <p class="text-text-primary tabular-nums">
              {result.avgBreathingRate} <span class="text-text-secondary text-xs">br/min</span>
            </p>
          </div>
        {/if}
      </div>

      <div class="flex gap-3 pt-1">
        <button
          onclick={onRetry}
          class="flex-1 py-2 rounded-md bg-bg-elevated text-text-primary text-sm
                 hover:bg-white/12 cursor-pointer transition-colors"
        >
          Try again
        </button>
        <button
          onclick={onClose}
          class="flex-1 py-2 rounded-md bg-accent-muted text-accent text-sm
                 hover:bg-accent/25 cursor-pointer transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  </div>
</div>
