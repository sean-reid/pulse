export type AppStatus =
  | 'idle'
  | 'requesting-camera'
  | 'loading-model'
  | 'calibrating'
  | 'active'
  | 'error';

let _started = $state(false);
let _status = $state<AppStatus>('idle');
let _error = $state<string | null>(null);

let _bpm = $state<number | null>(null);
let _bpmConfidence = $state(0);
let _breathingRate = $state<number | null>(null);
let _breathConfidence = $state(0);

let _avgBpm = $state<number | null>(null);
let _bpmVariability = $state<number | null>(null);

let _faceDetected = $state(false);
let _modelLoaded = $state(false);
let _cameraActive = $state(false);
let _calibrationProgress = $state(0);

let _waveformSignal = $state<Float64Array>(new Float64Array(0));
let _hrv = $state<{ sdnn: number; rmssd: number } | null>(null);
let _unstable = $state(false);

export const appState = {
  get started() {
    return _started;
  },
  set started(v: boolean) {
    _started = v;
  },

  get status() {
    return _status;
  },
  set status(v: AppStatus) {
    _status = v;
  },

  get error() {
    return _error;
  },
  set error(v: string | null) {
    _error = v;
  },

  get bpm() {
    return _bpm;
  },
  set bpm(v: number | null) {
    _bpm = v;
  },

  get bpmConfidence() {
    return _bpmConfidence;
  },
  set bpmConfidence(v: number) {
    _bpmConfidence = v;
  },

  get breathingRate() {
    return _breathingRate;
  },
  set breathingRate(v: number | null) {
    _breathingRate = v;
  },

  get breathConfidence() {
    return _breathConfidence;
  },
  set breathConfidence(v: number) {
    _breathConfidence = v;
  },

  get avgBpm() {
    return _avgBpm;
  },
  set avgBpm(v: number | null) {
    _avgBpm = v;
  },

  get bpmVariability() {
    return _bpmVariability;
  },
  set bpmVariability(v: number | null) {
    _bpmVariability = v;
  },

  get faceDetected() {
    return _faceDetected;
  },
  set faceDetected(v: boolean) {
    _faceDetected = v;
  },

  get modelLoaded() {
    return _modelLoaded;
  },
  set modelLoaded(v: boolean) {
    _modelLoaded = v;
  },

  get cameraActive() {
    return _cameraActive;
  },
  set cameraActive(v: boolean) {
    _cameraActive = v;
  },

  get calibrationProgress() {
    return _calibrationProgress;
  },
  set calibrationProgress(v: number) {
    _calibrationProgress = v;
  },

  get waveformSignal() {
    return _waveformSignal;
  },
  set waveformSignal(v: Float64Array) {
    _waveformSignal = v;
  },

  get hrv() {
    return _hrv;
  },
  set hrv(v: { sdnn: number; rmssd: number } | null) {
    _hrv = v;
  },

  get unstable() {
    return _unstable;
  },
  set unstable(v: boolean) {
    _unstable = v;
  },

  reset() {
    _bpm = null;
    _bpmConfidence = 0;
    _breathingRate = null;
    _breathConfidence = 0;
    _avgBpm = null;
    _bpmVariability = null;
    _faceDetected = false;
    _calibrationProgress = 0;
    _waveformSignal = new Float64Array(0);
    _hrv = null;
    _unstable = false;
  },
};
