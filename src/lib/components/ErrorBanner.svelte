<script lang="ts">
  interface Props {
    message: string;
    onRetry?: () => void;
  }

  let { message, onRetry }: Props = $props();
</script>

<div class="fixed inset-0 flex items-center justify-center bg-bg-primary p-6">
  <div class="flex flex-col items-center gap-5 max-w-sm text-center">
    <p class="text-text-primary text-sm leading-relaxed">{message}</p>
    {#if onRetry}
      <button
        onclick={onRetry}
        class="py-2.5 px-6 rounded-lg bg-bg-elevated text-text-primary text-sm
               hover:bg-white/12 cursor-pointer transition-colors"
      >
        Try again
      </button>
    {/if}
  </div>
</div>
