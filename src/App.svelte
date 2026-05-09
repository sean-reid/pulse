<script lang="ts">
  import { appState } from './lib/stores/app-state.svelte';
  import {
    requestCamera,
    stopCamera,
    getErrorMessage,
    type CameraError,
    type CameraResult,
  } from './lib/engine/camera';
  import { hasWebGL2, hasGetUserMedia } from './lib/utils/platform';
  import Onboarding from './lib/components/Onboarding.svelte';
  import CameraView from './lib/components/CameraView.svelte';
  import ErrorBanner from './lib/components/ErrorBanner.svelte';

  let cameraResult = $state<CameraResult | null>(null);
  let errorMessage = $state<string | null>(null);

  async function handleStart() {
    if (!hasGetUserMedia()) {
      errorMessage = getErrorMessage('not-supported');
      appState.status = 'error';
      return;
    }

    if (!hasWebGL2()) {
      errorMessage =
        'WebGL2 is required but not supported by your browser. Please use a recent version of Chrome, Firefox, or Safari.';
      appState.status = 'error';
      return;
    }

    appState.status = 'requesting-camera';
    errorMessage = null;

    try {
      cameraResult = await requestCamera();
      appState.cameraActive = true;
      appState.mode = 'live';
    } catch (err: unknown) {
      const cameraError = (err as { type: CameraError }).type || 'unknown';
      errorMessage = getErrorMessage(cameraError);
      appState.status = 'error';
    }
  }

  function handleRetry() {
    errorMessage = null;
    appState.status = 'idle';
    appState.mode = 'landing';
  }

  $effect(() => {
    return () => {
      if (cameraResult) {
        stopCamera(cameraResult.stream);
      }
    };
  });
</script>

{#if appState.mode === 'landing' && appState.status !== 'error'}
  <Onboarding onStart={handleStart} />
{/if}

{#if appState.status === 'error' && errorMessage}
  <ErrorBanner message={errorMessage} onRetry={handleRetry} />
{/if}

{#if cameraResult && appState.mode !== 'landing'}
  <CameraView video={cameraResult.video} />
{/if}
