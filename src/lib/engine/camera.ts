import { CAMERA_WIDTH, CAMERA_HEIGHT, CAMERA_FPS } from '../utils/constants';

export type CameraError =
  | 'not-allowed'
  | 'not-found'
  | 'not-readable'
  | 'overconstrained'
  | 'not-supported'
  | 'unknown';

export interface CameraResult {
  stream: MediaStream;
  video: HTMLVideoElement;
  actualWidth: number;
  actualHeight: number;
}

const ERROR_MESSAGES: Record<CameraError, string> = {
  'not-allowed':
    'Camera access was denied. Please allow camera access in your browser settings and reload.',
  'not-found': 'No camera detected. Please connect a camera and try again.',
  'not-readable':
    'Camera is already in use by another application. Close other apps using the camera and try again.',
  overconstrained: 'Camera does not support the required settings. Trying with default settings.',
  'not-supported':
    'Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Safari.',
  unknown: 'An unexpected error occurred while accessing the camera. Please try again.',
};

export function getErrorMessage(error: CameraError): string {
  return ERROR_MESSAGES[error];
}

function classifyError(err: unknown): CameraError {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return 'not-allowed';
      case 'NotFoundError':
        return 'not-found';
      case 'NotReadableError':
      case 'AbortError':
        return 'not-readable';
      case 'OverconstrainedError':
        return 'overconstrained';
      default:
        return 'unknown';
    }
  }
  return 'unknown';
}

export async function requestCamera(): Promise<CameraResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw { type: 'not-supported' as CameraError };
  }

  const constraints: MediaStreamConstraints = {
    video: {
      facingMode: 'user',
      width: { ideal: CAMERA_WIDTH },
      height: { ideal: CAMERA_HEIGHT },
      frameRate: { ideal: CAMERA_FPS },
    },
    audio: false,
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    const errorType = classifyError(err);
    if (errorType === 'overconstrained') {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
    } else {
      throw { type: errorType };
    }
  }

  const video = document.createElement('video');
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.muted = true;

  await video.play();

  return {
    stream,
    video,
    actualWidth: video.videoWidth,
    actualHeight: video.videoHeight,
  };
}

export function stopCamera(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}
