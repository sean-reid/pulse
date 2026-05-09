<script lang="ts">
  interface Props {
    onStart: () => void;
  }

  let { onStart }: Props = $props();
</script>

<div class="fixed inset-0 flex flex-col items-center justify-center bg-bg-primary">
  <div class="flex flex-col items-center gap-10 px-6 max-w-sm text-center">
    <div class="flex flex-col items-center gap-2">
      <h1 class="text-3xl font-semibold text-text-primary">pulse</h1>
      <p class="text-text-secondary text-sm">See your heartbeat</p>
    </div>

    <button
      onclick={onStart}
      class="py-3 px-10 rounded-lg bg-accent text-white font-medium text-sm
             hover:brightness-110 active:brightness-90 cursor-pointer transition-[filter]"
    >
      Start
    </button>

    <p class="text-text-tertiary text-xs leading-relaxed">
      Uses your camera to detect subtle color changes. Nothing is recorded or sent anywhere.
    </p>
  </div>
</div>
