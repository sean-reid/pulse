export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('webgl2');
    return ctx !== null;
  } catch {
    return false;
  }
}

export function hasGetUserMedia(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export function supportsBackdropFilter(): boolean {
  return CSS.supports('backdrop-filter', 'blur(1px)');
}
