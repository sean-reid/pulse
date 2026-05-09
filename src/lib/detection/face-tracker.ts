import type { ROI } from './rppg';

interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface FaceLandmarkerResult {
  faceLandmarks: Landmark[][];
}

interface FaceLandmarkerInstance {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => FaceLandmarkerResult;
}

interface FaceLandmarkerStatic {
  createFromOptions: (
    vision: VisionFilesetResolver,
    options: Record<string, unknown>,
  ) => Promise<FaceLandmarkerInstance>;
}

interface VisionFilesetResolver {
  forVisionTasks: (wasmPath: string) => Promise<VisionFilesetResolver>;
}

interface FaceLandmarkerModule {
  FaceLandmarker: FaceLandmarkerStatic;
  FilesetResolver: VisionFilesetResolver;
}

let faceLandmarker: FaceLandmarkerInstance | null = null;
let loading = false;
let loadPromise: Promise<void> | null = null;

const FOREHEAD_LANDMARKS = [10, 67, 69, 104, 108, 151, 284, 298, 299, 337];
const LEFT_CHEEK_LANDMARKS = [123, 147, 187, 205, 206, 216];
const RIGHT_CHEEK_LANDMARKS = [352, 376, 411, 425, 426, 436];

export async function loadFaceTracker(onProgress?: (msg: string) => void): Promise<void> {
  if (faceLandmarker) return;
  if (loadPromise) return loadPromise;

  loading = true;
  onProgress?.('Loading face detection model...');

  loadPromise = (async () => {
    const { FaceLandmarker, FilesetResolver } =
      (await import('@mediapipe/tasks-vision')) as unknown as FaceLandmarkerModule;

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    loading = false;
    onProgress?.('Face detection ready');
  })();

  return loadPromise;
}

export interface FaceROIs {
  forehead: ROI;
  leftCheek: ROI;
  rightCheek: ROI;
  chest: ROI;
}

export function detectFace(video: HTMLVideoElement, timestamp: number): FaceROIs | null {
  if (!faceLandmarker) return null;

  const result = faceLandmarker.detectForVideo(video, timestamp);
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) return null;

  const landmarks = result.faceLandmarks[0];
  const w = video.videoWidth;
  const h = video.videoHeight;

  const forehead = landmarksToROI(landmarks, FOREHEAD_LANDMARKS, w, h);
  const leftCheek = landmarksToROI(landmarks, LEFT_CHEEK_LANDMARKS, w, h);
  const rightCheek = landmarksToROI(landmarks, RIGHT_CHEEK_LANDMARKS, w, h);

  const noseTip = landmarks[1];
  const chin = landmarks[152];
  const faceHeight = Math.abs(chin.y - noseTip.y) * h;
  const chest: ROI = {
    x: Math.max(0, noseTip.x * w - faceHeight * 0.8),
    y: chin.y * h + faceHeight * 0.3,
    width: faceHeight * 1.6,
    height: faceHeight * 1.2,
  };
  chest.x = Math.max(0, Math.min(chest.x, w - chest.width));
  chest.y = Math.max(0, Math.min(chest.y, h - chest.height));
  chest.width = Math.min(chest.width, w - chest.x);
  chest.height = Math.min(chest.height, h - chest.y);

  return { forehead, leftCheek, rightCheek, chest };
}

function landmarksToROI(
  landmarks: Landmark[],
  indices: number[],
  width: number,
  height: number,
): ROI {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const idx of indices) {
    const lm = landmarks[idx];
    if (!lm) continue;
    const px = lm.x * width;
    const py = lm.y * height;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  const pad = 4;
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    width: Math.min(maxX - minX + pad * 2, width),
    height: Math.min(maxY - minY + pad * 2, height),
  };
}

export function isLoaded(): boolean {
  return faceLandmarker !== null;
}

export function isLoading(): boolean {
  return loading;
}
