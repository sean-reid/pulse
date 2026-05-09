<script lang="ts">
  import { appState } from '../stores/app-state.svelte';

  let dots = $state('');
  let interval: ReturnType<typeof setInterval>;

  $effect(() => {
    interval = setInterval(() => {
      dots = dots.length >= 3 ? '' : dots + '.';
    }, 500);
    return () => clearInterval(interval);
  });

  let statusText = $derived.by(() => {
    if (appState.status === 'calibrating') {
      return `Detecting pulse${dots}`;
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
  <div
    class="absolute top-4 left-1/2 -translate-x-1/2 z-30
              flex items-center gap-3 py-2.5 px-4 rounded-full
              bg-black/50 backdrop-blur-md border border-white/10"
  >
    {#if appState.status === 'calibrating'}
      <div class="relative w-5 h-5">
        <svg class="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            stroke-width="2"
          />
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="#ff4466"
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
        class="w-4 h-4 rounded-full border-2 border-white/20 border-t-text-primary animate-spin"
      ></div>
    {/if}
    <span class="text-text-primary text-sm font-medium">{statusText}</span>
  </div>
{/if}
