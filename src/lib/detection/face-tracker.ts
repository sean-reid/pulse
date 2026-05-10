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

const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

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

export interface FaceOvalPoint {
  x: number;
  y: number;
}

export interface CheekRegion {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface FaceROIs {
  forehead: ROI;
  leftCheek: ROI;
  rightCheek: ROI;
  chest: ROI;
  oval: FaceOvalPoint[];
  cheekRegions: [CheekRegion, CheekRegion];
  breathLandmarkY: number;
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

  const oval = getFaceOval(landmarks, w, h);

  const breathIndices = [4, 6, 152];
  let breathY = 0;
  for (const idx of breathIndices) {
    breathY += landmarks[idx].y * h;
  }
  breathY /= breathIndices.length;

  const cheekY = noseTip.y * h + faceHeight * 0.15;
  const cheekOffsetX = faceHeight * 0.45;
  const cheekRx = faceHeight * 0.25;
  const cheekRy = faceHeight * 0.2;
  const cheekRegions: [CheekRegion, CheekRegion] = [
    { cx: noseTip.x * w - cheekOffsetX, cy: cheekY, rx: cheekRx, ry: cheekRy },
    { cx: noseTip.x * w + cheekOffsetX, cy: cheekY, rx: cheekRx, ry: cheekRy },
  ];

  return { forehead, leftCheek, rightCheek, chest, oval, cheekRegions, breathLandmarkY: breathY };
}

function getFaceOval(landmarks: Landmark[], w: number, h: number): FaceOvalPoint[] {
  const points = FACE_OVAL_INDICES.map((i) => ({
    x: landmarks[i].x * w,
    y: landmarks[i].y * h,
  }));

  let cx = 0,
    cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;

  const expand = 1.2;
  return points.map((p) => ({
    x: cx + (p.x - cx) * expand,
    y: cy + (p.y - cy) * expand,
  }));
}

const MASK_W = 80;
const MASK_H = 60;
let maskCanvas: OffscreenCanvas | null = null;
let maskCtx: OffscreenCanvasRenderingContext2D | null = null;

export function generateFaceMask(
  oval: FaceOvalPoint[],
  cheeks: [CheekRegion, CheekRegion],
  videoW: number,
  videoH: number,
): OffscreenCanvas {
  if (!maskCanvas) {
    maskCanvas = new OffscreenCanvas(MASK_W, MASK_H);
    maskCtx = maskCanvas.getContext('2d')!;
  }

  const ctx = maskCtx!;
  ctx.clearRect(0, 0, MASK_W, MASK_H);

  const sx = MASK_W / videoW;
  const sy = MASK_H / videoH;

  let cx = 0;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of oval) {
    cx += p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
  }
  cx /= oval.length;
  const faceW = maxX - minX;
  const neckW = faceW * 0.6;
  const shoulderW = faceW * 2.2;
  const neckY = maxY;
  const shoulderY = maxY + faceW * 0.4;

  ctx.fillStyle = 'rgb(0, 255, 0)';
  ctx.beginPath();
  ctx.moveTo((cx - neckW / 2) * sx, neckY * sy);
  ctx.lineTo((cx - shoulderW / 2) * sx, shoulderY * sy);
  ctx.lineTo((cx - shoulderW / 2) * sx, MASK_H);
  ctx.lineTo((cx + shoulderW / 2) * sx, MASK_H);
  ctx.lineTo((cx + shoulderW / 2) * sx, shoulderY * sy);
  ctx.lineTo((cx + neckW / 2) * sx, neckY * sy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgb(255, 0, 0)';
  for (const cheek of cheeks) {
    ctx.beginPath();
    ctx.ellipse(cheek.cx * sx, cheek.cy * sy, cheek.rx * sx, cheek.ry * sy, 0, 0, 2 * Math.PI);
    ctx.fill();
  }

  return maskCanvas;
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
