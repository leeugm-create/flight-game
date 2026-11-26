// Coral Skylark — a small hand-rolled WebGL renderer: one lit program with
// sun shading and fog, one unlit program for glowing things (rings, the
// sun, lit windows), and a gradient sky dome. No engine, no network loads.

import { PALETTE, SUN_DIR } from './config.js';
import { mat4Perspective, mat4LookAt } from './math3d.js';

// Accumulates positions, normals and colours into one indexed mesh.
export class GeometryBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.indices = [];
  }
  addVertex(pos, normal, color) {
    this.positions.push(pos[0], pos[1], pos[2]);
    const len = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    this.normals.push(normal[0] / len, normal[1] / len, normal[2] / len);
    this.colors.push(color[0], color[1], color[2]);
    return this.positions.length / 3 - 1;
  }
  addTriangle(a, b, c) { this.indices.push(a, b, c); }
  addQuad(a, b, c, d) { this.addTriangle(a, b, c); this.addTriangle(a, c, d); }
  // Axis-aligned box between two corners, flat-shaded per face.
  addBox(min, max, color) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const faces = [
      { n: [0, 1, 0], v: [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]] },
      { n: [0, -1, 0], v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
      { n: [0, 0, 1], v: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
      { n: [0, 0, -1], v: [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]] },
      { n: [1, 0, 0], v: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
      { n: [-1, 0, 0], v: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]] },
    ];
    for (const f of faces) {
      const idx = f.v.map((p) => this.addVertex(p, f.n, color));
      this.addQuad(idx[0], idx[1], idx[2], idx[3]);
    }
  }
  vertexCount() { return this.positions.length / 3; }
}

const LIT_VERT = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;
uniform mat4 uMVP; uniform mat4 uModel;
varying vec3 vColor; varying vec3 vNormal; varying float vDist;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vColor = aColor;
  vNormal = mat3(uModel) * aNormal;
  vec4 clip = uMVP * vec4(aPos, 1.0);
  vDist = clip.w;
  gl_Position = clip;
}`;

const LIT_FRAG = `
precision mediump float;
uniform vec3 uSun; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar;
varying vec3 vColor; varying vec3 vNormal; varying float vDist;
void main() {
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uSun), 0.0);
  vec3 lit = vColor * (0.38 + 0.72 * diff);
  float f = smoothstep(uFogNear, uFogFar, vDist);
  gl_FragColor = vec4(mix(lit, uFog, f), 1.0);
}`;

const FLAT_VERT = `
attribute vec3 aPos; attribute vec3 aColor;
uniform mat4 uMVP; uniform mat4 uModel; uniform vec3 uTint;
varying vec3 vColor; varying float vDist;
void main() {
  vec4 clip = uMVP * uModel * vec4(aPos, 1.0);
  vColor = aColor * uTint; vDist = clip.w;
  gl_Position = clip;
}`;

const FLAT_FRAG = `
precision mediump float;
uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform float uAlpha; uniform float uUseFog;
varying vec3 vColor; varying float vDist;
void main() {
  float f = smoothstep(uFogNear, uFogFar, vDist) * uUseFog;
  gl_FragColor = vec4(mix(vColor, uFog, f), uAlpha);
}`;

function compileProgram(gl, vertSrc, fragSrc) {
  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('shader: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program: ' + gl.getProgramInfoLog(prog));
  }
  return prog;
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) throw new Error('WebGL is not available');
    gl.getExtension('OES_element_index_uint'); // world meshes exceed 65k vertices
    this.gl = gl;
    this.lit = compileProgram(gl, LIT_VERT, LIT_FRAG);
    this.flat = compileProgram(gl, FLAT_VERT, FLAT_FRAG);
    gl.enable(gl.DEPTH_TEST);
    // No face culling: normals are authored per face, and the sky dome and
    // ring hoops must read from both sides.
    this.fogNear = 900;
    this.fogFar = 5600;
    this.view = null;
    this.projection = null;
  }

  upload(builder) {
    const gl = this.gl;
    const mesh = { count: builder.indices.length };
    function buffer(target, data) {
      const b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      return b;
    }
    mesh.pos = buffer(gl.ARRAY_BUFFER, new Float32Array(builder.positions));
    mesh.normal = buffer(gl.ARRAY_BUFFER, new Float32Array(builder.normals));
    mesh.color = buffer(gl.ARRAY_BUFFER, new Float32Array(builder.colors));
    mesh.index = buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(builder.indices));
    return mesh;
  }

  beginFrame(eye, target, aspect) {
    const gl = this.gl;
    const w = gl.canvas.width, h = gl.canvas.height;
    if (gl.canvas.clientWidth && (canvasSizeStale(gl.canvas, w, h))) { /* resized below */ }
    gl.viewport(0, 0, w, h);
    gl.clearColor(PALETTE.fog[0], PALETTE.fog[1], PALETTE.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.projection = mat4Perspective(1.05, aspect, 0.5, 16000);
    this.view = mat4LookAt(eye, target, [0, 1, 0]);
    this.viewProj = null;
  }

  viewProjection() {
    if (!this.viewProj) {
      const m = new Array(16).fill(0);
      const a = this.projection, b = this.view;
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[col * 4 + k];
          m[col * 4 + row] = s;
        }
      }
      this.viewProj = m;
    }
    return this.viewProj;
  }

  drawLit(mesh, model) {
    const gl = this.gl;
    gl.useProgram(this.lit);
    this.bindMesh(this.lit, mesh, true);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.lit, 'uMVP'), false, this.modelViewProj(model));
    gl.uniformMatrix4fv(gl.getUniformLocation(this.lit, 'uModel'), false, model);
    gl.uniform3fv(gl.getUniformLocation(this.lit, 'uSun'), SUN_DIR);
    gl.uniform3fv(gl.getUniformLocation(this.lit, 'uFog'), PALETTE.fog);
    gl.uniform1f(gl.getUniformLocation(this.lit, 'uFogNear'), this.fogNear);
    gl.uniform1f(gl.getUniformLocation(this.lit, 'uFogFar'), this.fogFar);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
  }

  drawFlat(mesh, model, { alpha = 1, fog = 1, tint = [1, 1, 1] } = {}) {
    const gl = this.gl;
    gl.useProgram(this.flat);
    this.bindMesh(this.flat, mesh, false);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.flat, 'uMVP'), false, this.viewProjection());
    gl.uniformMatrix4fv(gl.getUniformLocation(this.flat, 'uModel'), false, model);
    gl.uniform3fv(gl.getUniformLocation(this.flat, 'uTint'), tint);
    gl.uniform1f(gl.getUniformLocation(this.flat, 'uAlpha'), alpha);
    gl.uniform1f(gl.getUniformLocation(this.flat, 'uUseFog'), fog);
    gl.uniform3fv(gl.getUniformLocation(this.flat, 'uFog'), PALETTE.fog);
    gl.uniform1f(gl.getUniformLocation(this.flat, 'uFogNear'), this.fogNear);
    gl.uniform1f(gl.getUniformLocation(this.flat, 'uFogFar'), this.fogFar);
    if (alpha < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    if (alpha < 1) gl.disable(gl.BLEND);
  }

  modelViewProj(model) {
    const vp = this.viewProjection();
    const m = new Array(16).fill(0);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += vp[k * 4 + row] * model[col * 4 + k];
        m[col * 4 + row] = s;
      }
    }
    return m;
  }

  bindMesh(prog, mesh, withNormals) {
    const gl = this.gl;
    function attrib(name, buf, size) {
      const loc = gl.getAttribLocation(prog, name);
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
    attrib('aPos', mesh.pos, 3);
    if (withNormals) attrib('aNormal', mesh.normal, 3);
    attrib('aColor', mesh.color, 3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
  }
}

function canvasSizeStale(canvas, w, h) {
  return canvas.clientWidth !== w || canvas.clientHeight !== h;
}

// Sky dome, sun disc and a scatter of flat-bottomed clouds, all unlit.
export function buildSkyGeometry(builder) {
  const R = 9500;
  const seg = 24, rings = 8;
  for (let j = 0; j <= rings; j++) {
    const phi = (j / rings) * Math.PI * 0.52;
    const y = Math.cos(phi) * R;
    const r = Math.sin(phi) * R;
    const t = j / rings;
    const color = [
      PALETTE.skyHorizon[0] + (PALETTE.skyTop[0] - PALETTE.skyHorizon[0]) * t,
      PALETTE.skyHorizon[1] + (PALETTE.skyTop[1] - PALETTE.skyHorizon[1]) * t,
      PALETTE.skyHorizon[2] + (PALETTE.skyTop[2] - PALETTE.skyHorizon[2]) * t,
    ];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      builder.addVertex([Math.cos(a) * r, y - 400, Math.sin(a) * r], [0, 1, 0], color);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      builder.addTriangle(a, b, c);
      builder.addTriangle(b, d, c);
    }
  }
}

export function buildSunGeometry(builder) {
  const dir = SUN_DIR;
  const c = [dir[0] * 8800, dir[1] * 8800, dir[2] * 8800];
  const s = 620;
  const right = [dir[2], 0, -dir[0]];
  const rl = Math.hypot(right[0], right[2]) || 1;
  right[0] /= rl; right[2] /= rl;
  const up = [
    right[1] * dir[2] - right[2] * dir[1],
    right[2] * dir[0] - right[0] * dir[2],
    right[0] * dir[1] - right[1] * dir[0],
  ];
  const col = [1.0, 0.93, 0.72];
  const corners = [
    [c[0] + (-right[0] - up[0]) * s, c[1] + (-right[1] - up[1]) * s, c[2] + (-right[2] - up[2]) * s],
    [c[0] + (right[0] - up[0]) * s, c[1] + (right[1] - up[1]) * s, c[2] + (right[2] - up[2]) * s],
    [c[0] + (right[0] + up[0]) * s, c[1] + (right[1] + up[1]) * s, c[2] + (right[2] + up[2]) * s],
    [c[0] + (-right[0] + up[0]) * s, c[1] + (-right[1] + up[1]) * s, c[2] + (-right[2] + up[2]) * s],
  ];
  const idx = corners.map((p) => builder.addVertex(p, [0, 1, 0], col));
  builder.addQuad(idx[0], idx[1], idx[2], idx[3]);
  builder.addQuad(idx[3], idx[2], idx[1], idx[0]);
}
