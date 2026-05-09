<script lang="ts">
  import { appState } from '../stores/app-state.svelte';

  let visible = $derived(appState.breathingRate !== null && appState.status === 'active');
</script>

{#if visible}
  <div
    class="absolute top-4 left-4 z-20 flex items-center gap-3
           py-3 px-4 rounded-2xl
           bg-black/40 backdrop-blur-xl border border-white/[0.08]
           shadow-lg shadow-black/20
           animate-fade-in"
  >
    <div class="w-6 h-6 flex items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="#44bbff" stroke-width="2" class="w-5 h-5">
        <path
          d="M12 22c4-4 8-7.5 8-12a8 8 0 00-16 0c0 4.5 4 8 8 12z"
          fill="#44bbff"
          opacity="0.15"
        />
        <path d="M12 22c4-4 8-7.5 8-12a8 8 0 00-16 0c0 4.5 4 8 8 12z" />
      </svg>
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-2xl font-bold text-text-primary tabular-nums leading-none">
        {appState.breathingRate}
      </span>
      <span class="text-xs text-text-secondary font-medium uppercase tracking-wider">br/m</span>
    </div>
  </div>
{/if}

<style>
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
