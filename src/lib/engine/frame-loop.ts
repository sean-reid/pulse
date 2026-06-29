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
  let smoothDt = 1 / CAMERA_FPS;

  const rppg = new RppgDetector();
  const breathing = new BreathingDetector();
  const fusion = new VitalsFusion();
  let currentROIs: FaceROIs | null = null;
  let calibrationFrames = 0;
  let lastFaceTime = 0;
  const bpmHistory: number[] = [];

  let cardiacPhase = 0;
  let guidedBlend = 0;
  let breathPhase = 0;
  let breathBlend = 0;
  let bodyCenterX = 0.5;
  let bodyCenterY = 0.7;
  let prevNoseX = 0;
  let prevNoseY = 0;
  let smoothJitter = 0;

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
    const dt =
      lastVideoTime < 0 ? 1 / CAMERA_FPS : Math.min(0.1, video.currentTime - lastVideoTime);
    lastVideoTime = video.currentTime;
    frameCount++;

    if (dt > 0 && dt < 0.1) {
      smoothDt += 0.05 * (dt - smoothDt);
    }
    const measuredFps = 1 / smoothDt;

    uploadVideoFrame(renderer, video);

    if (appState.bpm !== null) {
      cardiacPhase = (cardiacPhase + (2 * Math.PI * appState.bpm * dt) / 60) % (2 * Math.PI);
      const confidence = appState.bpmConfidence ?? 0;
      const targetBlend = Math.min(1, confidence * 1.5);
      guidedBlend += (targetBlend - guidedBlend) * Math.min(1, dt / BLEND_RAMP_S);
    } else {
      guidedBlend = Math.max(0, guidedBlend - dt / BLEND_DECAY_S);
    }

    // Breathing visualization is synthesized from a clean oscillator at the detected
    // rate, mirroring the cardiac drive above. This reads as smooth respiration rather
    // than tracking raw head motion, and ramps in and out with detection confidence.
    if (appState.breathingRate !== null) {
      breathPhase =
        (breathPhase + (2 * Math.PI * appState.breathingRate * dt) / 60) % (2 * Math.PI);
      const confidence = appState.breathConfidence ?? 0;
      const targetBlend = Math.min(1, confidence * 1.5);
      breathBlend += (targetBlend - breathBlend) * Math.min(1, dt / BLEND_RAMP_S);
    } else {
      breathBlend = Math.max(0, breathBlend - dt / BLEND_DECAY_S);
    }

    const ampParams: AmpParams = {
      pulseAlpha1: iirCoefficient(AMP_FREQ_MIN, CAMERA_FPS),
      pulseAlpha2: iirCoefficient(AMP_FREQ_MAX, CAMERA_FPS),
      breathAlpha1: iirCoefficient(BREATH_FREQ_MIN, CAMERA_FPS),
      breathAlpha2: iirCoefficient(BREATH_FREQ_MAX, CAMERA_FPS),
      pulseSignal: Math.sin(cardiacPhase) * guidedBlend,
      breathSignal: Math.sin(breathPhase) * breathBlend,
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

          bodyCenterX = (rois.chest.x + rois.chest.width / 2) / video.videoWidth;
          bodyCenterY = (rois.chest.y + rois.chest.height / 2) / video.videoHeight;

          const noseX = (rois.forehead.x + rois.forehead.width / 2) / video.videoWidth;
          const noseY = (rois.forehead.y + rois.forehead.height / 2) / video.videoHeight;
          if (prevNoseX > 0) {
            const dx = noseX - prevNoseX;
            const dy = noseY - prevNoseY;
            const displacement = Math.sqrt(dx * dx + dy * dy);
            smoothJitter += 0.15 * (displacement - smoothJitter);
          }
          prevNoseX = noseX;
          prevNoseY = noseY;
          appState.unstable = smoothJitter > 0.012;
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
            breathPhase = 0;
            breathBlend = 0;
            prevNoseX = 0;
            prevNoseY = 0;
            smoothJitter = 0;
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
          const rppgResult = rppg.computeBpm(measuredFps);
          const breathEstimates = breathing.getEstimates(
            measuredFps,
            measuredFps / FACE_DETECT_INTERVAL,
          );
          const fused = fusion.update(rppgResult, breathEstimates, performance.now(), measuredFps);

          if (fused.bpm !== null) {
            appState.bpm = fused.bpm;
            appState.bpmConfidence = fused.bpmConfidence;
            updateRollingStats(fused.bpm);
          }

          if (fused.signal.length > 0) {
            appState.waveformSignal = fused.signal;
          }

          appState.breathingRate = fused.breathRate;
          appState.breathConfidence = fused.breathConfidence;
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
      breathPhase = 0;
      breathBlend = 0;
      prevNoseX = 0;
      prevNoseY = 0;
      smoothJitter = 0;
    },
  };
}
