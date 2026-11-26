// Coral Skylark — the aeroplane herself: a coral-and-cream high-wing
// tourer built from boxes and prisms in model space (nose toward -z,
// wings along x, up is +y), plus her spinning propeller disc.

import { PALETTE } from './config.js';
import { GeometryBuilder } from './render3d.js';

const CORAL = PALETTE.coral;
const CREAM = PALETTE.cream;
const DARK = PALETTE.darkMetal;
const GLASS = [0.35, 0.55, 0.68];

// One fuselage cross-section: four corner points, bottom-left first,
// going clockwise seen from the nose.
function sectionPoints(z, halfW, yBot, yTop) {
  return [
    [-halfW, yBot, z],
    [halfW, yBot, z],
    [halfW, yTop, z],
    [-halfW, yTop, z],
  ];
}

// Joins two sections with four flat faces (bottom, right, top, left).
function joinSections(builder, a, b, color) {
  const faces = [
    { pts: [a[0], b[0], b[1], a[1]], n: [0, -1, 0] },
    { pts: [a[1], b[1], b[2], a[2]], n: [1, 0, 0] },
    { pts: [a[2], b[2], b[3], a[3]], n: [0, 1, 0] },
    { pts: [a[3], b[3], b[0], a[0]], n: [-1, 0, 0] },
  ];
  for (const f of faces) {
    const idx = f.pts.map((p) => builder.addVertex(p, f.n, color));
    builder.addQuad(idx[0], idx[1], idx[2], idx[3]);
  }
}

function capSection(builder, s, color, normal) {
  const idx = s.map((p) => builder.addVertex(p, normal, color));
  builder.addQuad(idx[0], idx[1], idx[2], idx[3]);
}

export function buildPlaneGeometry() {
  const b = new GeometryBuilder();
  // Fuselage: engine cowling, cabin, tapering tail cone.
  const nose = sectionPoints(-4.6, 0.85, -0.75, 0.75);
  const cabinF = sectionPoints(-1.2, 1.05, -0.95, 1.05);
  const cabinR = sectionPoints(1.6, 1.0, -0.9, 0.95);
  const tail = sectionPoints(4.9, 0.34, -0.3, 0.42);
  joinSections(b, nose, cabinF, CORAL);
  joinSections(b, cabinF, cabinR, CORAL);
  joinSections(b, cabinR, tail, CREAM);
  capSection(b, nose, DARK, [0, 0, -1]);
  capSection(b, tail, CREAM, [0, 0, 1]);
  // Cabin glasshouse and its coral roof.
  b.addBox([-0.92, 0.55, -1.55], [0.92, 1.62, 0.7], GLASS);
  b.addBox([-0.98, 1.5, -1.3], [0.98, 1.78, 0.9], CORAL);
  // Main wing (high wing) with coral tips.
  b.addBox([-6.4, 1.55, -0.9], [-1.0, 1.78, 0.75], CREAM);
  b.addBox([1.0, 1.55, -0.9], [6.4, 1.78, 0.75], CREAM);
  b.addBox([-7.3, 1.55, -0.85], [-6.4, 1.78, 0.7], CORAL);
  b.addBox([6.4, 1.55, -0.85], [7.3, 1.78, 0.7], CORAL);
  // Wing struts.
  b.addBox([-1.15, -0.4, -0.35], [-0.95, 1.55, -0.1], DARK);
  b.addBox([0.95, -0.4, -0.35], [1.15, 1.55, -0.1], DARK);
  // Tailplane and fin.
  b.addBox([-2.5, 0.28, 4.35], [2.5, 0.48, 5.15], CREAM);
  b.addBox([-0.16, 0.35, 4.3], [0.16, 2.3, 5.2], CORAL);
  // Fixed gear legs.
  b.addBox([-1.5, -1.75, -1.9], [-1.1, -0.8, -1.0], DARK);
  b.addBox([1.1, -1.75, -1.9], [1.5, -0.8, -1.0], DARK);
  b.addBox([-0.22, -1.55, 3.9], [0.22, -0.35, 4.5], DARK);
  // Spinner.
  b.addBox([-0.34, -0.34, -5.15], [0.34, 0.34, -4.55], DARK);
  return b;
}

// The propeller: a translucent disc the renderer spins by the clock.
export function buildPropGeometry() {
  const b = new GeometryBuilder();
  const seg = 20, r = 1.85, z = -5.2;
  const col = [0.25, 0.24, 0.26];
  const center = b.addVertex([0, 0, z], [0, 0, -1], col);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const p0 = b.addVertex([Math.cos(a0) * r, Math.sin(a0) * r, z], [0, 0, -1], col);
    const p1 = b.addVertex([Math.cos(a1) * r, Math.sin(a1) * r, z], [0, 0, -1], col);
    b.addTriangle(center, p1, p0);
  }
  return b;
}

// One ring hoop: a band of quads around the ring's circle, facing along
// the ring's normal. Built per ring so each can be coloured by its state
// (next / waiting / passed) through a model matrix in main.js.
export function buildRingGeometry(ring) {
  const b = new GeometryBuilder();
  const n = ring.normal;
  const up = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normCross(up, n);
  const v = normCross(n, u);
  const seg = 28, tube = 1.5;
  const col = [1, 1, 1];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const c0 = ringPoint(ring, u, v, a0, ring.radius - tube);
    const c1 = ringPoint(ring, u, v, a0, ring.radius + tube);
    const c2 = ringPoint(ring, u, v, a1, ring.radius + tube);
    const c3 = ringPoint(ring, u, v, a1, ring.radius - tube);
    const idx = [c0, c1, c2, c3].map((p) => b.addVertex(p, n, col));
    b.addQuad(idx[0], idx[1], idx[2], idx[3]);
  }
  return b;
}

function ringPoint(ring, u, v, angle, radius) {
  return [
    ring.pos[0] + (u[0] * Math.cos(angle) + v[0] * Math.sin(angle)) * radius,
    ring.pos[1] + (u[1] * Math.cos(angle) + v[1] * Math.sin(angle)) * radius,
    ring.pos[2] + (u[2] * Math.cos(angle) + v[2] * Math.sin(angle)) * radius,
  ];
}

function normCross(a, b) {
  const c = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const len = Math.hypot(c[0], c[1], c[2]) || 1;
  return [c[0] / len, c[1] / len, c[2] / len];
}
