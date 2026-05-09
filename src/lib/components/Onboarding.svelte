<script lang="ts">
  interface Props {
    onStart: () => void;
  }

  let { onStart }: Props = $props();
</script>

<div class="fixed inset-0 flex flex-col items-center justify-center bg-bg-primary z-50">
  <div class="flex flex-col items-center gap-8 px-6 max-w-sm text-center">
    <div class="flex flex-col items-center gap-3">
      <div class="relative">
        <div class="w-16 h-16 rounded-full bg-pulse-red/10 flex items-center justify-center">
          <div
            class="w-10 h-10 rounded-full bg-pulse-red/20 flex items-center justify-center animate-pulse-glow"
          >
            <div class="w-5 h-5 rounded-full bg-pulse-red"></div>
          </div>
        </div>
      </div>
      <h1 class="text-4xl font-semibold tracking-tight text-text-primary">pulse</h1>
      <p class="text-text-secondary text-base leading-relaxed">See your heartbeat</p>
    </div>

    <button
      onclick={onStart}
      class="w-full max-w-xs py-4 px-8 rounded-2xl bg-white/10 hover:bg-white/15 active:bg-white/20
             text-text-primary font-medium text-lg transition-all duration-200
             border border-white/10 hover:border-white/20
             backdrop-blur-sm cursor-pointer
             focus:outline-none focus:ring-2 focus:ring-pulse-red/50 focus:ring-offset-2 focus:ring-offset-bg-primary"
    >
      Start
    </button>

    <p class="text-text-secondary/60 text-xs leading-relaxed max-w-[280px]">
      Uses your camera to detect subtle color changes and micro-movements. Nothing is recorded or
      sent anywhere.
    </p>
  </div>
</div>

<style>
  @keyframes pulse-glow {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(255, 68, 102, 0.3);
    }
    50% {
      box-shadow: 0 0 20px 8px rgba(255, 68, 102, 0.15);
    }
  }
  .animate-pulse-glow {
    animation: pulse-glow 2.5s ease-in-out infinite;
  }
</style>
