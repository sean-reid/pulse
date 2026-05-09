<script lang="ts">
  import { appState } from '../stores/app-state.svelte';

  interface Props {
    signal: Float64Array;
    height?: number;
  }

  let { signal, height = 64 }: Props = $props();

  let canvas = $state<HTMLCanvasElement>(null!);
  let container = $state<HTMLDivElement>(null!);
  let visible = $derived(signal.length > 30 && appState.status === 'active');

  $effect(() => {
    if (!canvas || !visible || signal.length < 2 || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const data = signal;
    const len = data.length;

    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < len; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    const range = max - min || 1;
    const pad = 4;

    ctx.beginPath();
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--color-accent') || '#e8534a';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * width;
      const y = pad + ((max - data[i]) / range) * (height - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
</script>

{#if visible}
  <div bind:this={container} class="w-full max-w-sm">
    <canvas bind:this={canvas} style="width: 100%; height: {height}px; display: block;"></canvas>
  </div>
{/if}
