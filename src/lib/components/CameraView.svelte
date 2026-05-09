<script lang="ts">
  import { appState } from '../stores/app-state.svelte';
  import { createFrameLoop, type FrameLoop } from '../engine/frame-loop';
  import LoadingOverlay from './LoadingOverlay.svelte';
  import ModeSelector from './ModeSelector.svelte';
  import BreathGuide from './BreathGuide.svelte';
  import CheckMode from './CheckMode.svelte';
  import WaveformGraph from './WaveformGraph.svelte';
  import { MIN_AMPLIFICATION, MAX_AMPLIFICATION } from '../utils/constants';

  interface Props {
    video: HTMLVideoElement;
  }

  let { video }: Props = $props();

  let canvas = $state<HTMLCanvasElement>(null!);
  let frameLoop: FrameLoop | null = null;

  $effect(() => {
    if (canvas && video) {
      frameLoop = createFrameLoop(canvas, video);
      frameLoop.start();

      return () => {
        frameLoop?.destroy();
      };
    }
  });

  function handleAmplificationChange(e: Event) {
    const target = e.target as HTMLInputElement;
    appState.amplification = Number(target.value);
  }

  let beatDuration = $derived(appState.bpm ? 60 / appState.bpm : 1);
  let showVitals = $derived(appState.bpm !== null && appState.status === 'active');
  let showBreathing = $derived(appState.breathingRate !== null && appState.status === 'active');
</script>

<div class="fixed inset-0 bg-bg-primary flex flex-col">
  <div
    class="flex-1 flex flex-col items-center justify-start gap-5 px-4 pt-5 pb-2 overflow-hidden
              sm:pt-8 sm:gap-6"
  >
    <!-- Camera -->
    <div class="relative w-full max-w-xs rounded-lg overflow-hidden flex-shrink-0 sm:max-w-sm">
      <canvas bind:this={canvas} class="w-full aspect-[4/3] object-cover block"></canvas>
      <LoadingOverlay />

      <div class="absolute bottom-0 left-0 right-0 p-2">
        <input
          type="range"
          min={MIN_AMPLIFICATION}
          max={MAX_AMPLIFICATION}
          value={appState.amplification}
          oninput={handleAmplificationChange}
          class="w-full h-0.5 appearance-none bg-white/15 rounded cursor-pointer
                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/70"
        />
      </div>
    </div>

    <!-- Vitals -->
    <div class="flex flex-col items-center gap-3 flex-shrink-0">
      {#if showVitals}
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2.5">
            <div class="heartbeat" style="--beat-duration: {beatDuration}s">
              <div class="w-2.5 h-2.5 rounded-full bg-accent"></div>
            </div>
            <div class="flex items-baseline gap-1.5">
              <span class="text-4xl sm:text-5xl font-semibold text-text-primary tabular-nums">
                {appState.bpm}
              </span>
              <span class="text-xs text-text-secondary">bpm</span>
            </div>
          </div>

          {#if showBreathing}
            <div class="w-px h-8 bg-border-subtle"></div>
            <div class="flex items-baseline gap-1.5">
              <span class="text-4xl sm:text-5xl font-semibold text-text-primary tabular-nums">
                {appState.breathingRate}
              </span>
              <span class="text-xs text-text-secondary">br/min</span>
            </div>
          {/if}
        </div>
      {:else if appState.status === 'calibrating' || appState.status === 'active'}
        <div class="flex items-baseline gap-1.5">
          <span class="text-4xl font-semibold text-text-tertiary tabular-nums">--</span>
          <span class="text-xs text-text-tertiary">bpm</span>
        </div>
      {/if}
    </div>

    <!-- Waveform -->
    <WaveformGraph signal={appState.waveformSignal} height={64} />

    <!-- Mode-specific content -->
    <BreathGuide />
    <CheckMode />
  </div>

  <ModeSelector />
</div>

<style>
  @keyframes heartbeat {
    0%,
    30%,
    100% {
      transform: scale(1);
    }
    10% {
      transform: scale(1.4);
    }
    20% {
      transform: scale(1.1);
    }
  }
  .heartbeat {
    animation: heartbeat var(--beat-duration, 1s) ease-in-out infinite;
  }
</style>
