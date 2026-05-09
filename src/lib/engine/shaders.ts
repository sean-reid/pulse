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

export const PASSTHROUGH_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_texture;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  fragColor = texture(u_texture, v_texCoord);
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
uniform float u_pulseAlpha1;
uniform float u_pulseAlpha2;
uniform float u_breathAlpha1;
uniform float u_breathAlpha2;
uniform float u_pulseAmp;
uniform float u_breathAmp;

in vec2 v_texCoord;

layout(location = 0) out vec4 out_display;
layout(location = 1) out vec4 out_pulseLow1;
layout(location = 2) out vec4 out_pulseLow2;
layout(location = 3) out vec4 out_breathLow1;
layout(location = 4) out vec4 out_breathLow2;

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

  vec3 pulseTinted = pulseChroma * vec3(1.5, 0.7, 0.7);
  vec3 pulseDelta = clamp(u_pulseAmp * mask * pulseTinted, -0.15, 0.15);

  vec3 breathDelta = clamp(u_breathAmp * (1.0 - mask * 0.8) * breathBand, -0.06, 0.06);

  vec3 amplified = current + pulseDelta + breathDelta;

  out_display = vec4(clamp(amplified, 0.0, 1.0), 1.0);
  out_pulseLow1 = vec4(pL1New, 1.0);
  out_pulseLow2 = vec4(pL2New, 1.0);
  out_breathLow1 = vec4(bL1New, 1.0);
  out_breathLow2 = vec4(bL2New, 1.0);
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

void main() {
  vec4 color = texture(u_currentFrame, v_texCoord);
  out_display = color;
  out_pulseLow1 = color;
  out_pulseLow2 = color;
  out_breathLow1 = color;
  out_breathLow2 = color;
}
`;
