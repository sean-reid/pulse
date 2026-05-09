<script lang="ts">
  import { appState } from '../stores/app-state.svelte';
  import { createFrameLoop, type FrameLoop } from '../engine/frame-loop';
  import BpmDisplay from './BpmDisplay.svelte';
  import BreathDisplay from './BreathDisplay.svelte';
  import WaveformGraph from './WaveformGraph.svelte';
  import LoadingOverlay from './LoadingOverlay.svelte';
  import ModeSelector from './ModeSelector.svelte';
  import BreathGuide from './BreathGuide.svelte';
  import CheckMode from './CheckMode.svelte';
  import { DEFAULT_AMPLIFICATION, MIN_AMPLIFICATION, MAX_AMPLIFICATION } from '../utils/constants';

  interface Props {
    video: HTMLVideoElement;
  }

  let { video }: Props = $props();

  let canvas: HTMLCanvasElement;
  let frameLoop: FrameLoop | null = null;
  let waveformSignal = $state(new Float64Array(0));
  let showControls = $state(true);
  let controlsTimeout: ReturnType<typeof setTimeout>;

  $effect(() => {
    if (canvas && video) {
      frameLoop = createFrameLoop(canvas, video);
      frameLoop.start();

      const signalInterval = setInterval(() => {
        if (appState.bpm !== null) {
          const len = 128;
          const t = performance.now() / 1000;
          const freq = (appState.bpm || 72) / 60;
          const signal = new Float64Array(len);
          for (let i = 0; i < len; i++) {
            signal[i] = Math.sin(2 * Math.PI * freq * (t - (len - i) / 30)) + Math.random() * 0.1;
          }
          waveformSignal = signal;
        }
      }, 200);

      return () => {
        frameLoop?.destroy();
        clearInterval(signalInterval);
      };
    }
  });

  function handleTap() {
    showControls = !showControls;
    resetControlsTimer();
  }

  function resetControlsTimer() {
    clearTimeout(controlsTimeout);
    if (showControls) {
      controlsTimeout = setTimeout(() => {
        showControls = false;
      }, 5000);
    }
  }

  function handleAmplificationChange(e: Event) {
    const target = e.target as HTMLInputElement;
    appState.amplification = Number(target.value);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 bg-black" onclick={handleTap}>
  <canvas bind:this={canvas} class="w-full h-full object-cover" style="transform: scaleX(-1);"
  ></canvas>

  <BpmDisplay />
  <BreathDisplay />
  <WaveformGraph signal={waveformSignal} />
  <LoadingOverlay />
  <BreathGuide />
  <CheckMode />

  {#if showControls}
    <!-- Amplification slider -->
    <div class="absolute bottom-16 left-6 right-6 z-20 sm:bottom-20 sm:left-8 sm:right-8">
      <div
        class="flex items-center gap-3 py-2.5 px-4 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.06]"
      >
        <svg
          class="w-4 h-4 text-text-secondary flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M2 12h4l3-9 4 18 3-9h4" />
        </svg>
        <input
          type="range"
          min={MIN_AMPLIFICATION}
          max={MAX_AMPLIFICATION}
          value={appState.amplification}
          oninput={handleAmplificationChange}
          onclick={(e: Event) => e.stopPropagation()}
          class="flex-1 h-1 appearance-none bg-white/20 rounded-full cursor-pointer
                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-text-primary
                 [&::-webkit-slider-thumb]:shadow-md"
        />
        <span class="text-text-secondary text-xs tabular-nums w-6 text-right flex-shrink-0"
          >{appState.amplification}x</span
        >
      </div>
    </div>
  {/if}

  <ModeSelector />
</div>
