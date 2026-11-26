// Coral Skylark — small vector / matrix helpers for the WebGL renderer.
// Column-major 4x4 matrices in the gl.uniformMatrix4fv layout, plain arrays.

export function vec3(x = 0, y = 0, z = 0) { return [x, y, z]; }

export function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function scale3(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
export function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

export function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function length3(a) { return Math.hypot(a[0], a[1], a[2]); }

export function normalize3(a) {
  const len = length3(a) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

export function lerp(a, b, t) { return a + (b - a) * t; }

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Heading convention for the whole game: 0 rad faces north (-z), positive
// heading turns clockwise seen from above, so east (+x) is +PI/2.
export function forwardFromHeadingPitch(heading, pitch) {
  const cp = Math.cos(pitch);
  return [Math.sin(heading) * cp, Math.sin(pitch), -Math.cos(heading) * cp];
}

export function rightFromHeading(heading) {
  return [Math.cos(heading), 0, Math.sin(heading)];
}

export function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function mat4Multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

export function mat4Perspective(fovYRad, aspect, near, far) {
  const f = 1 / Math.tan(fovYRad / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
}

export function mat4LookAt(eye, target, up) {
  const zAxis = normalize3(sub3(eye, target));
  const xAxis = normalize3(cross3(up, zAxis));
  const yAxis = cross3(zAxis, xAxis);
  return [
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dot3(xAxis, eye), -dot3(yAxis, eye), -dot3(zAxis, eye), 1,
  ];
}

// Builds a model matrix from position + heading/pitch/roll (aeronautical
// order: yaw about Y, pitch about the new X, roll about the new Z-forward).
export function mat4FromFlightState(pos, heading, pitch, roll) {
  const ch = Math.cos(heading), sh = Math.sin(heading);
  const yaw = [
    ch, 0, sh, 0,
    0, 1, 0, 0,
    -sh, 0, ch, 0,
    0, 0, 0, 1,
  ];
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const pitchM = [
    1, 0, 0, 0,
    0, cp, sp, 0,
    0, -sp, cp, 0,
    0, 0, 0, 1,
  ];
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const rollM = [
    cr, -sr, 0, 0,
    sr, cr, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
  const rot = mat4Multiply(mat4Multiply(yaw, pitchM), rollM);
  rot[12] = pos[0]; rot[13] = pos[1]; rot[14] = pos[2];
  return rot;
}

export function transformPoint(m, p) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}
