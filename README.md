# pulse

See your heartbeat. Real-time pulse and breathing visualization using your camera.

**[Try it live](https://sean-reid.github.io/pulse/)**

## What it does

Uses your webcam to detect and amplify invisible micro-movements and color changes in your skin, revealing your heartbeat and breathing in real time.

- **Live mode** - Motion-amplified video feed with real-time BPM and breathing rate
- **Breathe mode** - Guided breathing exercises (4-7-8, box, coherence) with visual biofeedback
- **Check mode** - 60-second stress assessment with heart rate variability analysis

## How it works

- **Motion amplification** via IIR temporal bandpass filtering on the GPU (WebGL2)
- **Heart rate** from remote photoplethysmography (rPPG) - detecting subtle green channel fluctuations in your forehead skin caused by blood flow
- **Breathing rate** from frame-differenced motion energy in the chest/shoulder region
- **Face tracking** via MediaPipe FaceLandmarker for automatic ROI detection

Everything runs client-side in the browser. Nothing is recorded or sent anywhere.

## Development

```
npm install
npm run dev
```

## Tech

Svelte 5, TypeScript, Vite, TailwindCSS v4, WebGL2, MediaPipe, Vitest, Playwright
