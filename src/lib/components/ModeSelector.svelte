<script lang="ts">
  import { appState, type AppMode } from '../stores/app-state.svelte';

  interface Props {
    onModeChange?: (mode: AppMode) => void;
  }

  let { onModeChange }: Props = $props();

  const modes: { key: AppMode; label: string }[] = [
    { key: 'live', label: 'Live' },
    { key: 'breathe', label: 'Breathe' },
    { key: 'check', label: 'Check' },
  ];

  function selectMode(mode: AppMode) {
    appState.mode = mode;
    onModeChange?.(mode);
  }

  let visible = $derived(appState.status === 'active' || appState.status === 'calibrating');
</script>

{#if visible}
  <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 sm:bottom-8">
    <div
      class="flex items-center gap-1 p-1 rounded-full bg-black/50 backdrop-blur-xl border border-white/[0.08]"
    >
      {#each modes as mode (mode.key)}
        <button
          onclick={() => selectMode(mode.key)}
          class="relative py-2.5 px-5 rounded-full text-sm font-medium transition-all duration-200
                 min-w-[72px] cursor-pointer
                 {appState.mode === mode.key
            ? 'bg-white/15 text-text-primary shadow-sm'
            : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}"
        >
          {mode.label}
        </button>
      {/each}
    </div>
  </div>
{/if}
