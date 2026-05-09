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
uniform sampler2D u_iirLow1;
uniform sampler2D u_iirLow2;
uniform sampler2D u_mask;
uniform float u_alpha1;
uniform float u_alpha2;
uniform float u_amplification;

in vec2 v_texCoord;

layout(location = 0) out vec4 out_display;
layout(location = 1) out vec4 out_low1;
layout(location = 2) out vec4 out_low2;

void main() {
  vec3 current = texture(u_currentFrame, v_texCoord).rgb;
  vec3 low1Prev = texture(u_iirLow1, v_texCoord).rgb;
  vec3 low2Prev = texture(u_iirLow2, v_texCoord).rgb;

  vec3 low1New = low1Prev + u_alpha1 * (current - low1Prev);
  vec3 low2New = low2Prev + u_alpha2 * (current - low2Prev);

  float mask = texture(u_mask, v_texCoord).r;
  vec3 bandpass = low1New - low2New;
  vec3 delta = clamp(u_amplification * mask * bandpass, -0.12, 0.12);
  vec3 amplified = current + delta;

  out_display = vec4(clamp(amplified, 0.0, 1.0), 1.0);
  out_low1 = vec4(low1New, 1.0);
  out_low2 = vec4(low2New, 1.0);
}
`;

export const MOTION_AMP_INIT_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_currentFrame;
in vec2 v_texCoord;

layout(location = 0) out vec4 out_display;
layout(location = 1) out vec4 out_low1;
layout(location = 2) out vec4 out_low2;

void main() {
  vec4 color = texture(u_currentFrame, v_texCoord);
  out_display = color;
  out_low1 = color;
  out_low2 = color;
}
`;
