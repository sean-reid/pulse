export const PASSTHROUGH_VERT = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

export const DISPLAY_VERT = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = vec2(1.0 - a_texCoord.x, 1.0 - a_texCoord.y);
}
`;

export const MOTION_AMP_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_currentFrame;
uniform sampler2D u_pulseLow1;
uniform sampler2D u_pulseLow2;
uniform sampler2D u_breathLow1;
uniform sampler2D u_breathLow2;
uniform sampler2D u_mask;
uniform sampler2D u_pulseCorr;
uniform float u_pulseAlpha1;
uniform float u_pulseAlpha2;
uniform float u_breathAlpha1;
uniform float u_breathAlpha2;
uniform float u_pulseAmp;
uniform float u_breathAmp;
uniform float u_cardiacCos;
uniform float u_cardiacSin;
uniform float u_corrAlpha;
uniform float u_guidedBlend;

in vec2 v_texCoord;

layout(location = 0) out vec4 out_display;
layout(location = 1) out vec4 out_pulseLow1;
layout(location = 2) out vec4 out_pulseLow2;
layout(location = 3) out vec4 out_breathLow1;
layout(location = 4) out vec4 out_breathLow2;
layout(location = 5) out vec4 out_pulseCorr;

void main() {
  vec3 current = texture(u_currentFrame, v_texCoord).rgb;

  vec3 pL1 = texture(u_pulseLow1, v_texCoord).rgb;
  vec3 pL2 = texture(u_pulseLow2, v_texCoord).rgb;
  vec3 pL1New = pL1 + u_pulseAlpha1 * (current - pL1);
  vec3 pL2New = pL2 + u_pulseAlpha2 * (current - pL2);
  vec3 pulseBand = pL1New - pL2New;

  float pulseY = 0.299 * pulseBand.r + 0.587 * pulseBand.g + 0.114 * pulseBand.b;
  vec3 pulseChroma = pulseBand - vec3(pulseY);

  vec3 bL1 = texture(u_breathLow1, v_texCoord).rgb;
  vec3 bL2 = texture(u_breathLow2, v_texCoord).rgb;
  vec3 bL1New = bL1 + u_breathAlpha1 * (current - bL1);
  vec3 bL2New = bL2 + u_breathAlpha2 * (current - bL2);
  vec3 breathBand = bL1New - bL2New;

  float mask = texture(u_mask, v_texCoord).r;

  // --- Pulse amplification: broadband + phase-coherent beamforming ---
  const vec3 flushTint = vec3(1.8, 0.6, 0.6);
  const vec3 flushDir = normalize(flushTint);
  vec3 pulseTinted = pulseChroma * flushTint;

  // Broadband path (works before BPM detection)
  vec3 broadband = u_pulseAmp * 4.0 * mask * pulseTinted;

  // Phase-coherent path: complex phasor correlation (cardiac beamforming)
  vec2 prevCorr = texture(u_pulseCorr, v_texCoord).rg;
  float pulseSignal = dot(pulseTinted, flushDir);
  vec2 corrUpdate = pulseSignal * vec2(u_cardiacCos, -u_cardiacSin);
  vec2 corrNew = prevCorr + u_corrAlpha * (corrUpdate - prevCorr);
  float guidedSignal = corrNew.r * u_cardiacCos - corrNew.g * u_cardiacSin;
  vec3 guided = u_pulseAmp * 8.0 * mask * guidedSignal * flushDir;

  // Crossfade from broadband to phase-coherent as confidence builds
  vec3 rawPulse = mix(broadband, guided, u_guidedBlend);

  // Soft compression (tanh)
  float pulseLen = length(rawPulse);
  float pulseLimit = 0.30;
  vec3 pulseDelta = pulseLen > 1e-6
    ? rawPulse * (pulseLimit * tanh(pulseLen / pulseLimit) / pulseLen)
    : vec3(0.0);

  // --- Breathing amplification ---
  vec3 rawBreath = u_breathAmp * (1.0 - mask * 0.5) * breathBand;
  float breathLen = length(rawBreath);
  float breathLimit = 0.30;
  vec3 breathDelta = breathLen > 1e-6
    ? rawBreath * (breathLimit * tanh(breathLen / breathLimit) / breathLen)
    : vec3(0.0);

  vec3 amplified = current + pulseDelta + breathDelta;

  out_display = vec4(clamp(amplified, 0.0, 1.0), 1.0);
  out_pulseLow1 = vec4(pL1New, 1.0);
  out_pulseLow2 = vec4(pL2New, 1.0);
  out_breathLow1 = vec4(bL1New, 1.0);
  out_breathLow2 = vec4(bL2New, 1.0);
  out_pulseCorr = vec4(corrNew, 0.0, 1.0);
}
`;

export const MOTION_AMP_INIT_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_currentFrame;
in vec2 v_texCoord;

layout(location = 0) out vec4 out_display;
layout(location = 1) out vec4 out_pulseLow1;
layout(location = 2) out vec4 out_pulseLow2;
layout(location = 3) out vec4 out_breathLow1;
layout(location = 4) out vec4 out_breathLow2;
layout(location = 5) out vec4 out_pulseCorr;

void main() {
  vec4 color = texture(u_currentFrame, v_texCoord);
  out_display = color;
  out_pulseLow1 = color;
  out_pulseLow2 = color;
  out_breathLow1 = color;
  out_breathLow2 = color;
  out_pulseCorr = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

export const BLUR_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_direction;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  // 5-tap separable Gaussian, sigma ~ 1.2
  const float w0 = 0.3434;
  const float w1 = 0.2428;
  const float w2 = 0.0855;

  vec3 result = texture(u_texture, v_texCoord).rgb * w0;
  result += texture(u_texture, v_texCoord + 1.0 * u_direction).rgb * w1;
  result += texture(u_texture, v_texCoord - 1.0 * u_direction).rgb * w1;
  result += texture(u_texture, v_texCoord + 2.0 * u_direction).rgb * w2;
  result += texture(u_texture, v_texCoord - 2.0 * u_direction).rgb * w2;
  fragColor = vec4(result, 1.0);
}
`;
