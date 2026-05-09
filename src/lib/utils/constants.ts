export const CAMERA_WIDTH = 640;
export const CAMERA_HEIGHT = 480;
export const CAMERA_FPS = 30;

export const BPM_MIN = 40;
export const BPM_MAX = 200;
export const BPM_FREQ_MIN = BPM_MIN / 60;
export const BPM_FREQ_MAX = BPM_MAX / 60;

export const AMP_FREQ_MIN = BPM_FREQ_MIN;
export const AMP_FREQ_MAX = BPM_FREQ_MAX;

export const BREATH_FREQ_MIN = 0.1;
export const BREATH_FREQ_MAX = 0.6;
export const BREATH_MIN = BREATH_FREQ_MIN * 60;
export const BREATH_MAX = BREATH_FREQ_MAX * 60;

export const SIGNAL_BUFFER_SIZE = 256;
export const BPM_UPDATE_INTERVAL = 60;
export const FACE_DETECT_INTERVAL = 3;

export const AMPLIFICATION = 10;

export const ROI_SAMPLE_SIZE = 32;

export const CALIBRATION_FRAMES = 150;
