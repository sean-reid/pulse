<script lang="ts">
  import { appState } from '../stores/app-state.svelte';

  let visible = $derived(appState.bpm !== null && appState.status === 'active');
  let beatDuration = $derived(appState.bpm ? 60 / appState.bpm : 1);
</script>

{#if visible}
  <div
    class="absolute top-4 right-4 z-20 flex items-center gap-3
           py-3 px-4 rounded-2xl
           bg-black/40 backdrop-blur-xl border border-white/[0.08]
           shadow-lg shadow-black/20
           animate-fade-in"
  >
    <div
      class="w-6 h-6 flex items-center justify-center animate-heartbeat"
      style="--beat-duration: {beatDuration}s"
    >
      <svg viewBox="0 0 24 24" fill="#ff4466" class="w-5 h-5">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-3xl font-bold text-text-primary tabular-nums leading-none">
        {appState.bpm}
      </span>
      <span class="text-xs text-text-secondary font-medium uppercase tracking-wider">bpm</span>
    </div>
  </div>
{/if}

<style>
  @keyframes heartbeat {
    0%,
    30%,
    100% {
      transform: scale(1);
    }
    10% {
      transform: scale(1.25);
    }
    20% {
      transform: scale(1.1);
    }
  }
  .animate-heartbeat {
    animation: heartbeat var(--beat-duration, 1s) ease-in-out infinite;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-8px);
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
