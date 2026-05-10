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

export const DISPLAY_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_texture;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  fragColor = vec4(texture(u_texture, v_texCoord).rgb, 1.0);
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
uniform float u_pulseSignal;
uniform float u_breathSignal;
uniform vec2 u_bodyCenter;

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

  vec3 bL1 = texture(u_breathLow1, v_texCoord).rgb;
  vec3 bL2 = texture(u_breathLow2, v_texCoord).rgb;
  vec3 bL1New = bL1 + u_breathAlpha1 * (current - bL1);
  vec3 bL2New = bL2 + u_breathAlpha2 * (current - bL2);

  // Mask: R = face oval, G = face + body region
  vec4 maskSample = texture(u_mask, v_texCoord);
  float faceMask = maskSample.r;
  float bodyMask = maskSample.g * (1.0 - faceMask);

  // Breathing: horizontal chest expansion, tapered vertically for natural bulge
  float dx = v_texCoord.x - u_bodyCenter.x;
  float dy = abs(v_texCoord.y - u_bodyCenter.y);
  float taper = 1.0 - smoothstep(0.0, 0.2, dy);
  float expansion = max(0.0, u_breathSignal) * bodyMask * taper * 0.30;
  float shrink = 1.0 / (1.0 + expansion);
  vec2 warpedCoord = vec2(u_bodyCenter.x + dx * shrink, v_texCoord.y);
  vec3 pixel = texture(u_currentFrame, warpedCoord).rgb;

  // Pulse: multiplicative skin-tone warming from global cardiac signal
  float flush = u_pulseSignal * faceMask;
  vec3 amplified = pixel * vec3(
    1.0 + flush * 0.40,
    1.0 - flush * 0.12,
    1.0 - flush * 0.14
  );

  out_display = vec4(clamp(amplified, 0.0, 1.0), 1.0);
  out_pulseLow1 = vec4(pL1New, 1.0);
  out_pulseLow2 = vec4(pL2New, 1.0);
  out_breathLow1 = vec4(bL1New, 1.0);
  out_breathLow2 = vec4(bL2New, 1.0);
  out_pulseCorr = vec4(0.0, 0.0, 0.0, 1.0);
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
