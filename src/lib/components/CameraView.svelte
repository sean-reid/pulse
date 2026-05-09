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
  let showVitals = $derived(
    appState.faceDetected && appState.bpm !== null && appState.status === 'active',
  );
  let showBreathing = $derived(
    appState.faceDetected && appState.breathingRate !== null && appState.status === 'active',
  );
  let showStats = $derived(
    appState.faceDetected && appState.avgBpm !== null && appState.status === 'active',
  );
  const classLabels = { relaxed: 'Relaxed', moderate: 'Moderate', elevated: 'Elevated' };
  const classColors = { relaxed: 'text-green', moderate: 'text-amber', elevated: 'text-accent' };
</script>

<div class="fixed inset-0 bg-bg-primary flex flex-col">
  <div
    class="flex-1 flex flex-col items-center justify-center gap-4 px-4 pb-6 overflow-hidden
              sm:gap-5"
  >
    <!-- Camera -->
    <div class="relative w-full max-w-xs rounded-lg overflow-hidden flex-shrink-0 sm:max-w-sm">
      <canvas bind:this={canvas} class="w-full aspect-[4/3] object-cover block"></canvas>
      <LoadingOverlay />
    </div>

    <!-- Current vitals -->
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
      {:else if appState.faceDetected && (appState.status === 'calibrating' || appState.status === 'active')}
        <div class="flex items-baseline gap-1.5">
          <span class="text-4xl font-semibold text-text-tertiary tabular-nums">--</span>
          <span class="text-xs text-text-tertiary">bpm</span>
        </div>
      {/if}
    </div>

    <!-- Waveform + stats -->
    <div class="flex flex-col items-center gap-2 w-full">
      <WaveformGraph signal={appState.waveformSignal} height={64} />

      {#if showStats}
        <div class="w-full max-w-sm flex items-center justify-between text-sm px-2">
          <div>
            <span class="text-text-tertiary text-xs">Avg</span>
            <span class="text-text-primary tabular-nums ml-1">{appState.avgBpm}</span>
            <span class="text-text-tertiary text-xs ml-0.5">bpm</span>
          </div>
          <div>
            <span class="text-text-tertiary text-xs">Variability</span>
            <span class="text-text-primary tabular-nums ml-1">{appState.bpmVariability}</span>
          </div>
          {#if appState.classification}
            <span class="{classColors[appState.classification]} text-sm font-medium">
              {classLabels[appState.classification]}
            </span>
          {/if}
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
