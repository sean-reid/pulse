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
  <div class="flex-shrink-0 flex justify-center pb-6 pt-2 sm:pb-8">
    <div class="flex items-center gap-1">
      {#each modes as mode (mode.key)}
        <button
          onclick={() => selectMode(mode.key)}
          class="py-2 px-5 rounded-md text-sm cursor-pointer transition-colors
                 {appState.mode === mode.key
            ? 'bg-bg-elevated text-text-primary'
            : 'text-text-secondary hover:text-text-primary'}"
        >
          {mode.label}
        </button>
      {/each}
    </div>
  </div>
{/if}
