import {
  type RendererState,
  initRenderer,
  uploadVideoFrame,
  uploadMask,
  renderMotionAmp,
  renderToScreen,
  destroyRenderer,
} from './renderer';
import {
  loadFaceTracker,
  detectFace,
  generateFaceMask,
  isLoaded,
  type FaceROIs,
} from '../detection/face-tracker';
import { RppgDetector } from '../detection/rppg';
import { BreathingDetector } from '../detection/breathing';
import { iirCoefficient } from '../utils/math';
import { appState } from '../stores/app-state.svelte';
import {
  AMP_FREQ_MIN,
  AMP_FREQ_MAX,
  CAMERA_FPS,
  FACE_DETECT_INTERVAL,
  BPM_UPDATE_INTERVAL,
  BREATH_DETECT_INTERVAL,
  CALIBRATION_FRAMES,
} from '../utils/constants';

export interface FrameLoop {
  start: () => void;
  stop: () => void;
  destroy: () => void;
}

export function createFrameLoop(canvas: HTMLCanvasElement, video: HTMLVideoElement): FrameLoop {
  let renderer: RendererState | null = null;
  let animationId = 0;
  let running = false;
  let lastVideoTime = -1;
  let frameCount = 0;

  const rppg = new RppgDetector();
  const breathing = new BreathingDetector();
  let currentROIs: FaceROIs | null = null;
  let calibrationFrames = 0;

  function init() {
    renderer = initRenderer(canvas, video.videoWidth, video.videoHeight);

    loadFaceTracker((msg) => {
      if (msg.includes('ready')) {
        appState.modelLoaded = true;
      }
    }).catch(() => {
      // Face detection failed to load - app still works for motion amp
    });
  }

  function loop() {
    if (!running || !renderer) return;
    animationId = requestAnimationFrame(loop);

    if (video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    frameCount++;

    uploadVideoFrame(renderer, video);

    const alpha1 = iirCoefficient(AMP_FREQ_MIN, CAMERA_FPS);
    const alpha2 = iirCoefficient(AMP_FREQ_MAX, CAMERA_FPS);
    const amp = appState.amplification;

    renderMotionAmp(renderer, alpha1, alpha2, amp);
    renderToScreen(renderer);

    if (isLoaded()) {
      if (frameCount % FACE_DETECT_INTERVAL === 0) {
        const rois = detectFace(video, performance.now());
        if (rois) {
          currentROIs = rois;
          appState.faceDetected = true;

          const mask = generateFaceMask(rois.oval, video.videoWidth, video.videoHeight);
          uploadMask(renderer, mask);
        } else {
          appState.faceDetected = false;
        }
      }

      if (currentROIs) {
        rppg.sampleFrame(video, [
          currentROIs.forehead,
          currentROIs.leftCheek,
          currentROIs.rightCheek,
        ]);

        if (frameCount % BREATH_DETECT_INTERVAL === 0) {
          breathing.sampleFrame(video, currentROIs.chest);
        }

        if (appState.status === 'calibrating') {
          calibrationFrames++;
          appState.calibrationProgress = Math.min(1, calibrationFrames / CALIBRATION_FRAMES);
          if (calibrationFrames >= CALIBRATION_FRAMES) {
            appState.status = 'active';
          }
        }

        if (frameCount % BPM_UPDATE_INTERVAL === 0) {
          const bpmResult = rppg.computeBpm();
          if (bpmResult) {
            appState.bpm = bpmResult.bpm;
            appState.bpmConfidence = bpmResult.confidence;
            appState.waveformSignal = bpmResult.signal;
          }

          const breathResult = breathing.computeBreathingRate();
          if (breathResult) {
            appState.breathingRate = breathResult.rate;
          }
        }
      }
    }
  }

  return {
    start() {
      if (running) return;
      init();
      running = true;
      appState.status = 'calibrating';
      loop();
    },
    stop() {
      running = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = 0;
      }
    },
    destroy() {
      this.stop();
      if (renderer) {
        destroyRenderer(renderer);
        renderer = null;
      }
      rppg.reset();
      breathing.reset();
      currentROIs = null;
      calibrationFrames = 0;
      frameCount = 0;
      lastVideoTime = -1;
    },
  };
}
