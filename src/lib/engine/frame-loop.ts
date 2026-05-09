import {
  type RendererState,
  type AmpParams,
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
import { VitalsFusion } from '../detection/vitals-fusion';
import { iirCoefficient } from '../utils/math';
import { appState, type Classification } from '../stores/app-state.svelte';
import {
  AMP_FREQ_MIN,
  AMP_FREQ_MAX,
  BREATH_FREQ_MIN,
  BREATH_FREQ_MAX,
  AMPLIFICATION,
  CAMERA_FPS,
  FACE_DETECT_INTERVAL,
  BPM_UPDATE_INTERVAL,
  CALIBRATION_FRAMES,
} from '../utils/constants';

const MAX_HISTORY = 60;
const FACE_LOST_TIMEOUT_MS = 3000;

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
  const landmarkSampleRate = CAMERA_FPS / FACE_DETECT_INTERVAL;
  const breathing = new BreathingDetector(landmarkSampleRate);
  const fusion = new VitalsFusion();
  let currentROIs: FaceROIs | null = null;
  let calibrationFrames = 0;
  let lastFaceTime = 0;
  const bpmHistory: number[] = [];

  function updateRollingStats(bpm: number) {
    bpmHistory.push(bpm);
    if (bpmHistory.length > MAX_HISTORY) bpmHistory.shift();
    if (bpmHistory.length < 3) return;

    const avg = bpmHistory.reduce((a, b) => a + b, 0) / bpmHistory.length;
    const variance =
      bpmHistory.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (bpmHistory.length - 1);
    const stdDev = Math.sqrt(variance);

    appState.avgBpm = Math.round(avg);
    appState.bpmVariability = Math.round(stdDev * 10) / 10;

    let cls: Classification;
    if (avg < 72 && stdDev < 8) cls = 'relaxed';
    else if (avg > 90 || stdDev > 15) cls = 'elevated';
    else cls = 'moderate';
    appState.classification = cls;
  }

  function init() {
    renderer = initRenderer(canvas, video.videoWidth, video.videoHeight);

    loadFaceTracker((msg) => {
      if (msg.includes('ready')) {
        appState.modelLoaded = true;
      }
    }).catch(() => {});
  }

  function loop() {
    if (!running || !renderer) return;
    animationId = requestAnimationFrame(loop);

    if (video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    frameCount++;

    uploadVideoFrame(renderer, video);

    const ampParams: AmpParams = {
      pulseAlpha1: iirCoefficient(AMP_FREQ_MIN, CAMERA_FPS),
      pulseAlpha2: iirCoefficient(AMP_FREQ_MAX, CAMERA_FPS),
      breathAlpha1: iirCoefficient(BREATH_FREQ_MIN, CAMERA_FPS),
      breathAlpha2: iirCoefficient(BREATH_FREQ_MAX, CAMERA_FPS),
      pulseAmp: AMPLIFICATION,
      breathAmp: AMPLIFICATION * 1.5,
    };

    renderMotionAmp(renderer, ampParams);
    renderToScreen(renderer);

    if (isLoaded()) {
      if (frameCount % FACE_DETECT_INTERVAL === 0) {
        const now = performance.now();
        const rois = detectFace(video, now);
        if (rois) {
          currentROIs = rois;
          lastFaceTime = now;
          appState.faceDetected = true;

          const mask = generateFaceMask(rois.oval, video.videoWidth, video.videoHeight);
          uploadMask(renderer, mask);

          breathing.sampleLandmarks(rois.breathLandmarkY);
        } else {
          currentROIs = null;
          appState.faceDetected = false;

          if (
            lastFaceTime > 0 &&
            now - lastFaceTime > FACE_LOST_TIMEOUT_MS &&
            appState.status === 'active'
          ) {
            appState.status = 'calibrating';
            appState.reset();
            rppg.reset();
            breathing.reset();
            fusion.reset();
            calibrationFrames = 0;
            bpmHistory.length = 0;
          }
        }
      }

      if (currentROIs) {
        rppg.sampleFrame(video, [
          currentROIs.forehead,
          currentROIs.leftCheek,
          currentROIs.rightCheek,
        ]);

        breathing.sampleMotion(video, currentROIs.chest);

        if (appState.status === 'calibrating') {
          calibrationFrames++;
          appState.calibrationProgress = Math.min(1, calibrationFrames / CALIBRATION_FRAMES);
          if (calibrationFrames >= CALIBRATION_FRAMES) {
            appState.status = 'active';
          }
        }

        if (frameCount % BPM_UPDATE_INTERVAL === 0) {
          const rppgResult = rppg.computeBpm();
          const breathEstimates = breathing.getEstimates();
          const fused = fusion.update(rppgResult, breathEstimates, performance.now());

          if (fused.bpm !== null) {
            appState.bpm = fused.bpm;
            appState.bpmConfidence = fused.bpmConfidence;
            updateRollingStats(fused.bpm);
          }

          if (fused.signal.length > 0) {
            appState.waveformSignal = fused.signal;
          }

          appState.breathingRate = fused.breathRate;
          appState.hrv = fused.hrv;
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
      fusion.reset();
      currentROIs = null;
      calibrationFrames = 0;
      lastFaceTime = 0;
      frameCount = 0;
      lastVideoTime = -1;
      bpmHistory.length = 0;
    },
  };
}
