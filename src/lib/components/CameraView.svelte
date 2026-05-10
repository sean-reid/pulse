<script lang="ts">
  import { appState } from '../stores/app-state.svelte';
  import { createFrameLoop, type FrameLoop } from '../engine/frame-loop';
  import LoadingOverlay from './LoadingOverlay.svelte';
  import WaveformGraph from './WaveformGraph.svelte';

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

  let beatDuration = $derived(appState.bpm ? 60 / appState.bpm : 1);
  let stable = $derived(!appState.unstable);
  let showVitals = $derived(
    appState.faceDetected && appState.bpm !== null && appState.status === 'active' && stable,
  );
  let showBreathing = $derived(
    appState.faceDetected &&
      appState.breathingRate !== null &&
      appState.status === 'active' &&
      stable,
  );
  let showStats = $derived(
    appState.faceDetected && appState.avgBpm !== null && appState.status === 'active' && stable,
  );
</script>

<div class="fixed inset-0">
  <canvas bind:this={canvas} class="w-full h-full object-cover"></canvas>

  <LoadingOverlay />

  {#if !appState.faceDetected && appState.modelLoaded && appState.status !== 'idle'}
    <div class="absolute inset-0 flex items-center justify-center">
      <span class="text-sm text-white/60 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
        Position your face in the frame
      </span>
    </div>
  {:else if appState.unstable && appState.faceDetected && appState.status === 'active'}
    <div class="absolute inset-0 flex items-center justify-center">
      <span class="text-sm text-white/70 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
        Hold steady for accurate readings
      </span>
    </div>
  {/if}

  <div
    class="absolute bottom-0 left-0 right-0 pt-24 pb-8 px-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
  >
    <div class="flex flex-col items-center gap-3 max-w-sm mx-auto">
      {#if showVitals}
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2.5">
            <div class="heartbeat" style="--beat-duration: {beatDuration}s">
              <div class="w-2.5 h-2.5 rounded-full bg-accent"></div>
            </div>
            <div class="flex items-baseline gap-1.5">
              <span class="text-4xl font-semibold text-white tabular-nums drop-shadow-lg">
                {appState.bpm}
              </span>
              <span class="text-xs text-white/60">bpm</span>
            </div>
          </div>

          {#if showBreathing}
            <div class="w-px h-8 bg-white/15"></div>
            <div class="flex items-baseline gap-1.5">
              <span class="text-4xl font-semibold text-white tabular-nums drop-shadow-lg">
                {appState.breathingRate}
              </span>
              <span class="text-xs text-white/60">br/min</span>
            </div>
          {/if}
        </div>
      {:else if appState.faceDetected && (appState.status === 'calibrating' || appState.status === 'active')}
        <div class="flex items-baseline gap-1.5">
          <span class="text-4xl font-semibold text-white/30 tabular-nums">--</span>
          <span class="text-xs text-white/30">bpm</span>
        </div>
      {/if}

      <WaveformGraph signal={appState.waveformSignal} height={48} />

      {#if showStats}
        <div class="w-full flex items-center justify-between text-xs px-1">
          <div>
            <span class="text-white/40">Avg</span>
            <span class="text-white/80 tabular-nums ml-1">{appState.avgBpm}</span>
            <span class="text-white/40 ml-0.5">bpm</span>
          </div>
          <div>
            <span class="text-white/40">Variability</span>
            <span class="text-white/80 tabular-nums ml-1">{appState.bpmVariability}</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
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
