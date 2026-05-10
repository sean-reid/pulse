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
import { appState } from '../stores/app-state.svelte';
import {
  AMP_FREQ_MIN,
  AMP_FREQ_MAX,
  BREATH_FREQ_MIN,
  BREATH_FREQ_MAX,
  CAMERA_FPS,
  FACE_DETECT_INTERVAL,
  BPM_UPDATE_INTERVAL,
  CALIBRATION_FRAMES,
} from '../utils/constants';

const MAX_HISTORY = 60;
const FACE_GRACE_MS = 500;
const FACE_RESET_MS = 10000;
const BLEND_RAMP_S = 3;
const BLEND_DECAY_S = 1;

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

  let cardiacPhase = 0;
  let guidedBlend = 0;
  let breathBaseline = 0;
  let breathBaselineInit = false;
  let breathSignalRaw = 0;
  let smoothBreathSignal = 0;
  let bodyCenterX = 0.5;
  let bodyCenterY = 0.7;

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

    if (appState.bpm !== null) {
      cardiacPhase =
        (cardiacPhase + (2 * Math.PI * appState.bpm) / (60 * CAMERA_FPS)) % (2 * Math.PI);
      const confidence = appState.bpmConfidence ?? 0;
      const targetBlend = Math.min(1, confidence * 1.5);
      guidedBlend += (targetBlend - guidedBlend) / (BLEND_RAMP_S * CAMERA_FPS);
    } else {
      guidedBlend = Math.max(0, guidedBlend - 1 / (BLEND_DECAY_S * CAMERA_FPS));
    }

    smoothBreathSignal += 0.5 * (breathSignalRaw - smoothBreathSignal);

    const ampParams: AmpParams = {
      pulseAlpha1: iirCoefficient(AMP_FREQ_MIN, CAMERA_FPS),
      pulseAlpha2: iirCoefficient(AMP_FREQ_MAX, CAMERA_FPS),
      breathAlpha1: iirCoefficient(BREATH_FREQ_MIN, CAMERA_FPS),
      breathAlpha2: iirCoefficient(BREATH_FREQ_MAX, CAMERA_FPS),
      pulseSignal: Math.sin(cardiacPhase) * guidedBlend,
      breathSignal: smoothBreathSignal,
      bodyCenterX,
      bodyCenterY,
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

          const mask = generateFaceMask(
            rois.oval,
            rois.cheekRegions,
            video.videoWidth,
            video.videoHeight,
          );
          uploadMask(renderer, mask);

          breathing.sampleLandmarks(rois.breathLandmarkY);

          const rawY = rois.breathLandmarkY;
          if (!breathBaselineInit) {
            breathBaseline = rawY;
            breathBaselineInit = true;
          } else {
            breathBaseline += 0.02 * (rawY - breathBaseline);
          }
          const normalizedDisp = -(rawY - breathBaseline) / video.videoHeight;
          breathSignalRaw = normalizedDisp * 80;

          bodyCenterX = (rois.chest.x + rois.chest.width / 2) / video.videoWidth;
          bodyCenterY = (rois.chest.y + rois.chest.height / 2) / video.videoHeight;
        } else if (lastFaceTime > 0 && now - lastFaceTime > FACE_GRACE_MS) {
          currentROIs = null;
          appState.faceDetected = false;

          if (now - lastFaceTime > FACE_RESET_MS && appState.status === 'active') {
            appState.status = 'calibrating';
            appState.reset();
            rppg.reset();
            breathing.reset();
            fusion.reset();
            calibrationFrames = 0;
            bpmHistory.length = 0;
            cardiacPhase = 0;
            guidedBlend = 0;
            breathBaseline = 0;
            breathBaselineInit = false;
            breathSignalRaw = 0;
            smoothBreathSignal = 0;
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
      animationId = requestAnimationFrame(loop);
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
      cardiacPhase = 0;
      guidedBlend = 0;
      breathBaseline = 0;
      breathBaselineInit = false;
      breathSignalRaw = 0;
      smoothBreathSignal = 0;
    },
  };
}
