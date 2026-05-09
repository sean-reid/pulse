<script lang="ts">
  import { appState } from '../stores/app-state.svelte';

  let dots = $state('');

  $effect(() => {
    const interval = setInterval(() => {
      dots = dots.length >= 3 ? '' : dots + '.';
    }, 500);
    return () => clearInterval(interval);
  });

  let statusText = $derived.by(() => {
    if (appState.status === 'calibrating') {
      return `Detecting${dots}`;
    }
    if (!appState.modelLoaded) {
      return `Loading${dots}`;
    }
    return '';
  });

  let progress = $derived(appState.status === 'calibrating' ? appState.calibrationProgress : 0);

  let visible = $derived(
    appState.status === 'calibrating' ||
      appState.status === 'loading-model' ||
      (!appState.modelLoaded && appState.cameraActive),
  );
</script>

{#if visible}
  <div class="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
    <div class="flex items-center gap-2 py-1.5 px-3 rounded-md bg-black/70">
      {#if appState.status === 'calibrating'}
        <div class="relative w-3.5 h-3.5">
          <svg class="w-3.5 h-3.5 -rotate-90" viewBox="0 0 20 20">
            <circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              stroke-width="2"
            />
            <circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              stroke="var(--color-accent)"
              stroke-width="2"
              stroke-dasharray={2 * Math.PI * 8}
              stroke-dashoffset={2 * Math.PI * 8 * (1 - progress)}
              stroke-linecap="round"
              class="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
        </div>
      {:else}
        <div
          class="w-3 h-3 rounded-full border-2 border-white/20 border-t-white/80 animate-spin"
        ></div>
      {/if}
      <span class="text-white/90 text-xs">{statusText}</span>
    </div>
  </div>
{/if}
