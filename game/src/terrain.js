// Coral Skylark — Kestrel Bay: one island heightfield shared by the mesh,
// the flight model's ground collision and every piece of scenery, so what
// you see is exactly what you can hit.

import { WORLD, RUNWAY, PALETTE } from './config.js';
import { fbm2 } from './noise.js';
import { clamp, smoothstep } from './math3d.js';

const TOWN = { x: 650, z: -150, radius: 300, elevation: 34 };

function rectDistance(x, z, cx, cz, halfL, halfW) {
  const dx = Math.max(Math.abs(x - cx) - halfL, 0);
  const dz = Math.max(Math.abs(z - cz) - halfW, 0);
  return Math.hypot(dx, dz);
}

// Ground height in metres at any world position. Sea floor sits below 0.
export function heightAt(x, z) {
  const dx = x - WORLD.islandCenterX;
  const dz = z - WORLD.islandCenterZ;
  const dist = Math.hypot(dx, dz);
  const land = smoothstep(WORLD.islandRadius, WORLD.islandRadius * 0.55, dist);

  const hills = fbm2(x * 0.00085 + 7.3, z * 0.00085 + 2.1, 4);
  const ridge = fbm2(x * 0.0026 + 1.7, z * 0.0026 + 8.4, 3);
  let h = -14 + land * 30 + Math.pow(hills, 1.6) * 300 * land + ridge * 36 * land;

  // A gentler plateau where the town stands.
  const townDist = Math.hypot(x - TOWN.x, z - TOWN.z);
  const townBlend = smoothstep(TOWN.radius, TOWN.radius * 0.35, townDist);
  h = h * (1 - townBlend) + (TOWN.elevation + ridge * 6) * townBlend;

  // The runway bench: dead flat, blended in over a grass margin.
  const rd = rectDistance(x, z, RUNWAY.centerX, RUNWAY.centerZ, RUNWAY.halfLength, RUNWAY.halfWidth);
  const bench = smoothstep(170, 30, rd);
  h = h * (1 - bench) + RUNWAY.elevation * bench;

  // The approach corridor: a low grass ramp running west from the
  // threshold, so final approach is flown over open ground, not a hillside.
  const cd = rectDistance(x, z, -1025, RUNWAY.centerZ, 575, 60);
  const corridor = smoothstep(170, 40, cd);
  h = h * (1 - corridor) + 13.5 * corridor;
  return h;
}

export function isOverRunway(x, z) {
  return Math.abs(x - RUNWAY.centerX) <= RUNWAY.halfLength &&
         Math.abs(z - RUNWAY.centerZ) <= RUNWAY.halfWidth;
}

function terrainColor(x, z, h, slope) {
  const vary = fbm2(x * 0.01 + 3.1, z * 0.01 + 9.2, 3) * 0.14 - 0.07;
  let c;
  if (h < 2.5) c = PALETTE.sand;
  else if (slope > 0.62) c = PALETTE.rock;
  else {
    const dry = fbm2(x * 0.0016 + 5.5, z * 0.0016 + 0.4, 2);
    c = dry > 0.55 ? PALETTE.grassDry : PALETTE.grass;
    if (h > 190) c = PALETTE.rock;
  }
  return [clamp(c[0] + vary, 0, 1), clamp(c[1] + vary, 0, 1), clamp(c[2] + vary, 0, 1)];
}

// Builds the island mesh into a geometry builder (see render3d.js).
export function buildTerrainGeometry(builder, segments = 150) {
  const ext = WORLD.extent;
  const step = (ext * 2) / segments;
  const indexOf = new Map();
  const heights = [];
  for (let j = 0; j <= segments; j++) {
    heights.push([]);
    for (let i = 0; i <= segments; i++) {
      const x = -ext + i * step;
      const z = -ext + j * step;
      heights[j].push(heightAt(x, z));
    }
  }
  function vertex(i, j) {
    const key = j * (segments + 1) + i;
    if (indexOf.has(key)) return indexOf.get(key);
    const x = -ext + i * step;
    const z = -ext + j * step;
    const h = heights[j][i];
    const hl = heights[j][Math.max(i - 1, 0)];
    const hr = heights[j][Math.min(i + 1, segments)];
    const hd = heights[Math.max(j - 1, 0)][i];
    const hu = heights[Math.min(j + 1, segments)][i];
    const nx = (hl - hr) / (2 * step);
    const nz = (hd - hu) / (2 * step);
    const slope = Math.hypot(nx, nz);
    const idx = builder.addVertex([x, h, z], [nx, 1, nz], terrainColor(x, z, h, slope));
    indexOf.set(key, idx);
    return idx;
  }
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = vertex(i, j), b = vertex(i + 1, j);
      const c = vertex(i, j + 1), d = vertex(i + 1, j + 1);
      builder.addTriangle(a, c, b);
      builder.addTriangle(b, c, d);
    }
  }
}

// The sea: one large calm sheet, coloured in two bands by distance.
export function buildSeaGeometry(builder) {
  const ext = WORLD.extent * 1.9;
  const y = WORLD.seaLevel;
  const c = PALETTE.sea;
  const a = builder.addVertex([-ext, y, -ext], [0, 1, 0], c);
  const b = builder.addVertex([ext, y, -ext], [0, 1, 0], c);
  const d = builder.addVertex([ext, y, ext], [0, 1, 0], c);
  const e = builder.addVertex([-ext, y, ext], [0, 1, 0], c);
  builder.addTriangle(a, b, e);
  builder.addTriangle(b, d, e);
}
