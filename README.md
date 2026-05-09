# pulse

See your heartbeat. Real-time pulse and breathing visualization using your camera.

**[Try it live](https://sean-reid.github.io/pulse/)**

## What it does

Uses your webcam to detect and amplify invisible micro-movements and color changes in your skin, revealing your heartbeat and breathing in real time. Shows continuous rolling stats including BPM, breathing rate, variability, and a live PPG waveform.

## How it works

### Signal acquisition
- **CHROM algorithm** (De Haan & Jelichen, 2013) extracts pulse signal from RGB chrominance across multiple face ROIs (forehead, cheeks) with skin-pixel filtering
- **Breathing detection** fuses three independent signals: chest motion energy, facial landmark displacement (nose, chin, bridge), and RSA-derived respiratory rate from heart rate variability
- **Face tracking** via MediaPipe FaceLandmarker for automatic ROI placement and face oval masking

### Signal processing
- Moving-average detrend, FFT-domain bandpass filtering, Hamming windowing
- Noise floor rejection (peak must exceed 2x median spectral power)
- Parabolic peak interpolation for sub-bin frequency resolution

### Sensor fusion
- **Kalman filter** tracks HR and breathing rate as 2D state vectors [rate, rate_velocity]
- Each measurement source provides its own noise variance, so the filter naturally weights high-quality sources more heavily
- Innovation gating rejects outlier measurements (3-sigma)
- RSA (respiratory sinus arrhythmia) cross-couples the two filters: heart rate variability informs breathing rate, and vice versa
- HRV metrics (SDNN, RMSSD) computed from beat-to-beat RR intervals

### Visualization
- **Dual-band motion amplification** via WebGL2 IIR temporal bandpass
  - Pulse band (0.67-3.33 Hz): chrominance-only amplification on face, warm color tint
  - Breathing band (0.1-0.6 Hz): motion amplification on body, suppressed on face
Everything runs client-side in the browser. Nothing is recorded or sent anywhere.

## Development

```
npm install
npm run dev
```

## Tech

Svelte 5, TypeScript, Vite, TailwindCSS v4, WebGL2, MediaPipe, Vitest, Playwright
