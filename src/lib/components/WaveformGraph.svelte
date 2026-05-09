<script lang="ts">
  import { appState } from '../stores/app-state.svelte';

  interface Props {
    signal: Float64Array;
    width?: number;
    height?: number;
  }

  let { signal, width = 300, height = 60 }: Props = $props();

  let canvas = $state<HTMLCanvasElement>(null!);
  let visible = $derived(signal.length > 30 && appState.status === 'active');

  $effect(() => {
    if (!canvas || !visible || signal.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
    ctx.strokeStyle = '#ff4466';
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

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(255, 68, 102, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 68, 102, 0)');

    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  });
</script>

{#if visible}
  <div
    class="absolute bottom-24 left-4 right-4 z-20
           rounded-xl overflow-hidden
           bg-black/30 backdrop-blur-md border border-white/[0.06]
           animate-fade-in sm:bottom-28"
  >
    <canvas bind:this={canvas} style="width: 100%; height: {height}px; display: block;"></canvas>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in {
    animation: fade-in 0.4s ease-out;
  }
</style>
