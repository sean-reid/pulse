import {
  PASSTHROUGH_VERT,
  DISPLAY_VERT,
  MOTION_AMP_FRAG,
  MOTION_AMP_INIT_FRAG,
  BLUR_FRAG,
} from './shaders';

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSource: string,
  fragSource: string,
): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSource);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

function createTexture(gl: WebGL2RenderingContext, width: number, height: number): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('Failed to create texture');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export interface RendererState {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  blurHProgram: WebGLProgram;
  blurVDisplayProgram: WebGLProgram;
  motionAmpProgram: WebGLProgram;
  motionAmpInitProgram: WebGLProgram;
  videoTexture: WebGLTexture;
  pulseLow1Textures: [WebGLTexture, WebGLTexture];
  pulseLow2Textures: [WebGLTexture, WebGLTexture];
  breathLow1Textures: [WebGLTexture, WebGLTexture];
  breathLow2Textures: [WebGLTexture, WebGLTexture];
  displayTextures: [WebGLTexture, WebGLTexture];
  maskTexture: WebGLTexture;
  framebuffers: [WebGLFramebuffer, WebGLFramebuffer];
  quadVAO: WebGLVertexArrayObject;
  pingPongIndex: number;
  initialized: boolean;
}

export function initRenderer(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): RendererState {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error('WebGL2 not supported');

  gl.getExtension('EXT_color_buffer_float');

  canvas.width = width;
  canvas.height = height;

  const blurHProgram = createProgram(gl, PASSTHROUGH_VERT, BLUR_FRAG);
  const blurVDisplayProgram = createProgram(gl, DISPLAY_VERT, BLUR_FRAG);
  const motionAmpProgram = createProgram(gl, PASSTHROUGH_VERT, MOTION_AMP_FRAG);
  const motionAmpInitProgram = createProgram(gl, PASSTHROUGH_VERT, MOTION_AMP_INIT_FRAG);

  const videoTexture = createTexture(gl, width, height);

  const pulseLow1Textures: [WebGLTexture, WebGLTexture] = [
    createTexture(gl, width, height),
    createTexture(gl, width, height),
  ];
  const pulseLow2Textures: [WebGLTexture, WebGLTexture] = [
    createTexture(gl, width, height),
    createTexture(gl, width, height),
  ];
  const breathLow1Textures: [WebGLTexture, WebGLTexture] = [
    createTexture(gl, width, height),
    createTexture(gl, width, height),
  ];
  const breathLow2Textures: [WebGLTexture, WebGLTexture] = [
    createTexture(gl, width, height),
    createTexture(gl, width, height),
  ];
  const displayTextures: [WebGLTexture, WebGLTexture] = [
    createTexture(gl, width, height),
    createTexture(gl, width, height),
  ];

  const maskTexture = createTexture(gl, 1, 1);
  const whitePx = new Uint8Array([255, 255, 255, 255]);
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, whitePx);

  const framebuffers: [WebGLFramebuffer, WebGLFramebuffer] = [
    gl.createFramebuffer()!,
    gl.createFramebuffer()!,
  ];

  const quadVAO = gl.createVertexArray()!;
  gl.bindVertexArray(quadVAO);

  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

  const posBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const texBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);

  return {
    gl,
    canvas,
    width,
    height,
    blurHProgram,
    blurVDisplayProgram,
    motionAmpProgram,
    motionAmpInitProgram,
    videoTexture,
    pulseLow1Textures,
    pulseLow2Textures,
    breathLow1Textures,
    breathLow2Textures,
    displayTextures,
    maskTexture,
    framebuffers,
    quadVAO,
    pingPongIndex: 0,
    initialized: false,
  };
}

export function uploadVideoFrame(state: RendererState, video: HTMLVideoElement): void {
  const { gl, videoTexture } = state;
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, video);
}

export function uploadMask(state: RendererState, maskCanvas: OffscreenCanvas): void {
  const { gl, maskTexture } = state;
  gl.bindTexture(gl.TEXTURE_2D, maskTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
}

export interface AmpParams {
  pulseAlpha1: number;
  pulseAlpha2: number;
  breathAlpha1: number;
  breathAlpha2: number;
  pulseAmp: number;
  breathAmp: number;
}

export function renderMotionAmp(state: RendererState, params: AmpParams): void {
  const { gl, quadVAO, width, height } = state;
  const curr = state.pingPongIndex;
  const next = 1 - curr;

  const drawBuffers = [
    gl.COLOR_ATTACHMENT0,
    gl.COLOR_ATTACHMENT1,
    gl.COLOR_ATTACHMENT2,
    gl.COLOR_ATTACHMENT3,
    gl.COLOR_ATTACHMENT4,
  ];

  if (!state.initialized) {
    gl.useProgram(state.motionAmpInitProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffers[next]);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      state.displayTextures[next],
      0,
    );
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT1,
      gl.TEXTURE_2D,
      state.pulseLow1Textures[next],
      0,
    );
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT2,
      gl.TEXTURE_2D,
      state.pulseLow2Textures[next],
      0,
    );
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT3,
      gl.TEXTURE_2D,
      state.breathLow1Textures[next],
      0,
    );
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT4,
      gl.TEXTURE_2D,
      state.breathLow2Textures[next],
      0,
    );
    gl.drawBuffers(drawBuffers);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.videoTexture);
    gl.uniform1i(gl.getUniformLocation(state.motionAmpInitProgram, 'u_currentFrame'), 0);

    gl.viewport(0, 0, width, height);
    gl.bindVertexArray(quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    state.initialized = true;
    state.pingPongIndex = next;
    return;
  }

  const program = state.motionAmpProgram;
  gl.useProgram(program);

  gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffers[next]);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    state.displayTextures[next],
    0,
  );
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT1,
    gl.TEXTURE_2D,
    state.pulseLow1Textures[next],
    0,
  );
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT2,
    gl.TEXTURE_2D,
    state.pulseLow2Textures[next],
    0,
  );
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT3,
    gl.TEXTURE_2D,
    state.breathLow1Textures[next],
    0,
  );
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT4,
    gl.TEXTURE_2D,
    state.breathLow2Textures[next],
    0,
  );
  gl.drawBuffers(drawBuffers);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.videoTexture);
  gl.uniform1i(gl.getUniformLocation(program, 'u_currentFrame'), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.pulseLow1Textures[curr]);
  gl.uniform1i(gl.getUniformLocation(program, 'u_pulseLow1'), 1);

  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, state.pulseLow2Textures[curr]);
  gl.uniform1i(gl.getUniformLocation(program, 'u_pulseLow2'), 2);

  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, state.breathLow1Textures[curr]);
  gl.uniform1i(gl.getUniformLocation(program, 'u_breathLow1'), 3);

  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, state.breathLow2Textures[curr]);
  gl.uniform1i(gl.getUniformLocation(program, 'u_breathLow2'), 4);

  gl.activeTexture(gl.TEXTURE5);
  gl.bindTexture(gl.TEXTURE_2D, state.maskTexture);
  gl.uniform1i(gl.getUniformLocation(program, 'u_mask'), 5);

  gl.uniform1f(gl.getUniformLocation(program, 'u_pulseAlpha1'), params.pulseAlpha1);
  gl.uniform1f(gl.getUniformLocation(program, 'u_pulseAlpha2'), params.pulseAlpha2);
  gl.uniform1f(gl.getUniformLocation(program, 'u_breathAlpha1'), params.breathAlpha1);
  gl.uniform1f(gl.getUniformLocation(program, 'u_breathAlpha2'), params.breathAlpha2);
  gl.uniform1f(gl.getUniformLocation(program, 'u_pulseAmp'), params.pulseAmp);
  gl.uniform1f(gl.getUniformLocation(program, 'u_breathAmp'), params.breathAmp);

  gl.viewport(0, 0, width, height);
  gl.bindVertexArray(quadVAO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  state.pingPongIndex = next;
}

export function renderToScreen(state: RendererState): void {
  const { gl, quadVAO, width, height } = state;
  const curr = state.pingPongIndex;
  const other = 1 - curr;

  // Pass 1: horizontal blur — read amplified display, write to other display slot
  gl.useProgram(state.blurHProgram);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffers[other]);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    state.displayTextures[other],
    0,
  );
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.displayTextures[curr]);
  gl.uniform1i(gl.getUniformLocation(state.blurHProgram, 'u_texture'), 0);
  gl.uniform2f(gl.getUniformLocation(state.blurHProgram, 'u_direction'), 1.0 / width, 0);

  gl.viewport(0, 0, width, height);
  gl.bindVertexArray(quadVAO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Pass 2: vertical blur + mirror flip — read h-blurred, draw to screen
  gl.useProgram(state.blurVDisplayProgram);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.canvas.width, state.canvas.height);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.displayTextures[other]);
  gl.uniform1i(gl.getUniformLocation(state.blurVDisplayProgram, 'u_texture'), 0);
  gl.uniform2f(gl.getUniformLocation(state.blurVDisplayProgram, 'u_direction'), 0, 1.0 / height);

  gl.bindVertexArray(quadVAO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export function destroyRenderer(state: RendererState): void {
  const { gl } = state;
  gl.deleteProgram(state.blurHProgram);
  gl.deleteProgram(state.blurVDisplayProgram);
  gl.deleteProgram(state.motionAmpProgram);
  gl.deleteProgram(state.motionAmpInitProgram);
  gl.deleteTexture(state.videoTexture);
  gl.deleteTexture(state.maskTexture);
  for (const t of state.pulseLow1Textures) gl.deleteTexture(t);
  for (const t of state.pulseLow2Textures) gl.deleteTexture(t);
  for (const t of state.breathLow1Textures) gl.deleteTexture(t);
  for (const t of state.breathLow2Textures) gl.deleteTexture(t);
  for (const t of state.displayTextures) gl.deleteTexture(t);
  for (const fb of state.framebuffers) gl.deleteFramebuffer(fb);
  gl.deleteVertexArray(state.quadVAO);
}
