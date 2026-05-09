export type AppMode = 'landing' | 'live' | 'breathe' | 'check';
export type AppStatus =
  | 'idle'
  | 'requesting-camera'
  | 'loading-model'
  | 'calibrating'
  | 'active'
  | 'error';

export type BreathPattern = '4-7-8' | 'box' | 'coherence';

let _mode = $state<AppMode>('landing');
let _status = $state<AppStatus>('idle');
let _error = $state<string | null>(null);

let _bpm = $state<number | null>(null);
let _bpmConfidence = $state(0);
let _breathingRate = $state<number | null>(null);
let _amplification = $state(15);

let _faceDetected = $state(false);
let _modelLoaded = $state(false);
let _cameraActive = $state(false);
let _calibrationProgress = $state(0);

let _breathPattern = $state<BreathPattern>('4-7-8');
let _breathPhase = $state<'inhale' | 'hold' | 'exhale' | 'idle'>('idle');
let _breathSynced = $state(false);
let _sessionTime = $state(0);

let _checkTimeRemaining = $state(60);
let _checkActive = $state(false);

export const appState = {
  get mode() {
    return _mode;
  },
  set mode(v: AppMode) {
    _mode = v;
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

  get amplification() {
    return _amplification;
  },
  set amplification(v: number) {
    _amplification = v;
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

  get breathPattern() {
    return _breathPattern;
  },
  set breathPattern(v: BreathPattern) {
    _breathPattern = v;
  },

  get breathPhase() {
    return _breathPhase;
  },
  set breathPhase(v: 'inhale' | 'hold' | 'exhale' | 'idle') {
    _breathPhase = v;
  },

  get breathSynced() {
    return _breathSynced;
  },
  set breathSynced(v: boolean) {
    _breathSynced = v;
  },

  get sessionTime() {
    return _sessionTime;
  },
  set sessionTime(v: number) {
    _sessionTime = v;
  },

  get checkTimeRemaining() {
    return _checkTimeRemaining;
  },
  set checkTimeRemaining(v: number) {
    _checkTimeRemaining = v;
  },

  get checkActive() {
    return _checkActive;
  },
  set checkActive(v: boolean) {
    _checkActive = v;
  },

  reset() {
    _bpm = null;
    _bpmConfidence = 0;
    _breathingRate = null;
    _faceDetected = false;
    _calibrationProgress = 0;
    _breathPhase = 'idle';
    _breathSynced = false;
    _sessionTime = 0;
    _checkTimeRemaining = 60;
    _checkActive = false;
  },
};
