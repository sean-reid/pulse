<script lang="ts">
  interface Props {
    message: string;
    onRetry?: () => void;
  }

  let { message, onRetry }: Props = $props();
</script>

<div
  class="fixed inset-0 flex items-center justify-center bg-bg-primary/90 backdrop-blur-sm z-50 p-6"
>
  <div class="flex flex-col items-center gap-6 max-w-sm text-center">
    <div class="w-14 h-14 rounded-full bg-pulse-red/10 flex items-center justify-center">
      <svg
        class="w-7 h-7 text-pulse-red"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </div>
    <p class="text-text-primary text-base leading-relaxed">{message}</p>
    {#if onRetry}
      <button
        onclick={onRetry}
        class="py-3 px-6 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20
               text-text-primary font-medium text-sm transition-all duration-200
               border border-white/10 cursor-pointer"
      >
        Try Again
      </button>
    {/if}
  </div>
</div>
