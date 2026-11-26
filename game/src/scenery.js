// Coral Skylark — the built world on the island: the runway strip with its
// markings, the town of Kestrel Bay, a lighthouse on the point, pine trees
// on the hills and buoys in the water. Lit geometry goes to the world mesh;
// window glass and the lighthouse lamp go to the glow mesh.

import { RUNWAY, PALETTE } from './config.js';
import { heightAt } from './terrain.js';
import { fbm2, seededRandom } from './noise.js';

const BUILDING_WALLS = [
  [0.92, 0.88, 0.78], [0.85, 0.80, 0.70], [0.95, 0.91, 0.84],
  [0.78, 0.72, 0.62], [0.88, 0.82, 0.72],
];
const ROOF = [0.62, 0.30, 0.20];
const PINE = [0.16, 0.38, 0.20];
const TRUNK = [0.35, 0.25, 0.16];

export function buildRunwayGeometry(builder) {
  const y = RUNWAY.elevation + 0.15;
  const { centerX: cx, centerZ: cz, halfLength: hl, halfWidth: hw } = RUNWAY;
  const c = PALETTE.runway;
  const a = builder.addVertex([cx - hl, y, cz - hw], [0, 1, 0], c);
  const b = builder.addVertex([cx + hl, y, cz - hw], [0, 1, 0], c);
  const d = builder.addVertex([cx + hl, y, cz + hw], [0, 1, 0], c);
  const e = builder.addVertex([cx - hl, y, cz + hw], [0, 1, 0], c);
  builder.addQuad(a, b, d, e);
  // Centreline dashes and threshold bars in paint white.
  const m = PALETTE.runwayMark;
  for (let x = -hl + 60; x < hl - 40; x += 90) {
    quad(builder, cx + x, y + 0.06, cz, 34, 2.2, m);
  }
  for (const endX of [-hl + 14, hl - 14]) {
    for (let k = -3; k <= 3; k++) {
      quad(builder, cx + endX, y + 0.06, cz + k * 5.4, 18, 3.0, m);
    }
  }
  // Edge lines.
  quad(builder, cx, y + 0.05, cz - hw + 2, hl * 2, 1.4, m);
  quad(builder, cx, y + 0.05, cz + hw - 2, hl * 2, 1.4, m);
}

function quad(builder, cx, y, cz, lenX, lenZ, color) {
  const a = builder.addVertex([cx - lenX / 2, y, cz - lenZ / 2], [0, 1, 0], color);
  const b = builder.addVertex([cx + lenX / 2, y, cz - lenZ / 2], [0, 1, 0], color);
  const d = builder.addVertex([cx + lenX / 2, y, cz + lenZ / 2], [0, 1, 0], color);
  const e = builder.addVertex([cx - lenX / 2, y, cz + lenZ / 2], [0, 1, 0], color);
  builder.addQuad(a, b, d, e);
}

export function buildTownGeometry(builder, glowBuilder) {
  const rand = seededRandom(20261126);
  const cx = 650, cz = -150;
  let placed = 0;
  for (let attempt = 0; attempt < 400 && placed < 64; attempt++) {
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * 265;
    const x = cx + Math.cos(angle) * dist;
    const z = cz + Math.sin(angle) * dist * 0.8;
    const ground = heightAt(x, z);
    if (ground < 12) continue;
    const w = 16 + rand() * 16;
    const d = 14 + rand() * 14;
    const hgt = 10 + rand() * 22;
    const wall = BUILDING_WALLS[Math.floor(rand() * BUILDING_WALLS.length)];
    builder.addBox([x - w / 2, ground - 1, z - d / 2], [x + w / 2, ground + hgt, z + d / 2], wall);
    builder.addBox([x - w / 2 - 1.5, ground + hgt, z - d / 2 - 1.5],
                   [x + w / 2 + 1.5, ground + hgt + 3.2, z + d / 2 + 1.5], ROOF);
    // Lit windows on the south face, into the glow mesh.
    const winCol = [1.0, 0.82, 0.45];
    const rows = Math.max(1, Math.floor(hgt / 7));
    for (let r = 0; r < rows; r++) {
      for (let k = -1; k <= 1; k++) {
        if (rand() < 0.35) continue;
        const wx = x + k * (w / 3.4);
        const wy = ground + 4 + r * 7;
        const wz = z + d / 2 + 0.15;
        const a = glowBuilder.addVertex([wx - 1.1, wy - 1.4, wz], [0, 0, 1], winCol);
        const b = glowBuilder.addVertex([wx + 1.1, wy - 1.4, wz], [0, 0, 1], winCol);
        const cc = glowBuilder.addVertex([wx + 1.1, wy + 1.4, wz], [0, 0, 1], winCol);
        const dd = glowBuilder.addVertex([wx - 1.1, wy + 1.4, wz], [0, 0, 1], winCol);
        glowBuilder.addQuad(a, b, cc, dd);
      }
    }
    placed++;
  }
}

export function buildLighthouseGeometry(builder, glowBuilder) {
  const x = 1560, z = 1180;
  const ground = Math.max(heightAt(x, z), 4);
  const segs = 10;
  const bands = [
    [0.93, 0.92, 0.88], [0.85, 0.22, 0.16], [0.93, 0.92, 0.88], [0.85, 0.22, 0.16],
  ];
  let y = ground - 2;
  for (let band = 0; band < 4; band++) {
    const hgt = 11;
    const r0 = 7.5 - band * 0.9, r1 = 7.5 - (band + 1) * 0.9;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      const p = [
        [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0],
        [x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0],
        [x + Math.cos(a1) * r1, y + hgt, z + Math.sin(a1) * r1],
        [x + Math.cos(a0) * r1, y + hgt, z + Math.sin(a0) * r1],
      ];
      const n = [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)];
      const idx = p.map((pt) => builder.addVertex(pt, n, bands[band]));
      builder.addQuad(idx[0], idx[1], idx[2], idx[3]);
    }
    y += hgt;
  }
  builder.addBox([x - 6, y, z - 6], [x + 6, y + 3, z + 6], PALETTE.darkMetal);
  const lamp = [1.0, 0.88, 0.5];
  const a = glowBuilder.addVertex([x - 4, y + 3, z - 4], [0, 1, 0], lamp);
  const b = glowBuilder.addVertex([x + 4, y + 3, z - 4], [0, 1, 0], lamp);
  const c = glowBuilder.addVertex([x + 4, y + 9, z + 4], [0, 1, 0], lamp);
  const d = glowBuilder.addVertex([x - 4, y + 9, z + 4], [0, 1, 0], lamp);
  glowBuilder.addQuad(a, b, c, d);
  glowBuilder.addQuad(d, c, b, a);
  builder.addBox([x - 5, y + 9, z - 5], [x + 5, y + 11.5, z + 5], [0.2, 0.2, 0.22]);
}

export function buildTreesGeometry(builder) {
  const rand = seededRandom(977351);
  let placed = 0;
  for (let attempt = 0; attempt < 2600 && placed < 340; attempt++) {
    const x = -2600 + rand() * 5200;
    const z = -2900 + rand() * 5200;
    const h = heightAt(x, z);
    if (h < 8 || h > 210) continue;
    if (Math.abs(z - RUNWAY.centerZ) < 90 && Math.abs(x) < RUNWAY.halfLength + 120) continue;
    if (Math.hypot(x - 650, z + 150) < 330) continue;
    const s = 7 + rand() * 8;
    builder.addBox([x - 0.9, h - 0.5, z - 0.9], [x + 0.9, h + s * 0.4, z + 0.9], TRUNK);
    cone(builder, x, h + s * 0.3, z, s * 0.52, s * 1.15, PINE);
    placed++;
  }
}

function cone(builder, cx, baseY, cz, radius, height, color) {
  const segs = 7;
  const apex = builder.addVertex([cx, baseY + height, cz], [0, 1, 0], color);
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    const p0 = builder.addVertex([cx + Math.cos(a0) * radius, baseY, cz + Math.sin(a0) * radius],
      [Math.cos(a0), 0.4, Math.sin(a0)], color);
    const p1 = builder.addVertex([cx + Math.cos(a1) * radius, baseY, cz + Math.sin(a1) * radius],
      [Math.cos(a1), 0.4, Math.sin(a1)], color);
    builder.addTriangle(p0, apex, p1);
  }
}

export function buildBuoysGeometry(builder, glowBuilder) {
  const rand = seededRandom(4451);
  for (let i = 0; i < 26; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 2750 + rand() * 900;
    const x = -200 + Math.cos(angle) * dist;
    const z = -300 + Math.sin(angle) * dist;
    if (heightAt(x, z) > -4) continue;
    builder.addBox([x - 2.2, -1, z - 2.2], [x + 2.2, 2.6, z + 2.2], [0.85, 0.25, 0.15]);
    const a = glowBuilder.addVertex([x - 1, 2.6, z - 1], [0, 1, 0], [1.0, 0.6, 0.3]);
    const b = glowBuilder.addVertex([x + 1, 2.6, z - 1], [0, 1, 0], [1.0, 0.6, 0.3]);
    const c = glowBuilder.addVertex([x + 1, 4.6, z + 1], [0, 1, 0], [1.0, 0.6, 0.3]);
    const d = glowBuilder.addVertex([x - 1, 4.6, z + 1], [0, 1, 0], [1.0, 0.6, 0.3]);
    glowBuilder.addQuad(a, b, c, d);
  }
}

export function buildCloudsGeometry(builder) {
  const rand = seededRandom(60221023);
  const white = [0.99, 0.99, 1.0];
  const shade = [0.86, 0.90, 0.96];
  for (let i = 0; i < 26; i++) {
    const cx = -5200 + rand() * 10400;
    const cz = -5200 + rand() * 10400;
    const cy = 620 + rand() * 420;
    const blobs = 3 + Math.floor(rand() * 3);
    for (let b = 0; b < blobs; b++) {
      const bx = cx + (rand() - 0.5) * 260;
      const bz = cz + (rand() - 0.5) * 150;
      const sx = 130 + rand() * 190;
      const sz = 80 + rand() * 110;
      builder.addBox([bx - sx, cy, bz - sz], [bx + sx, cy + 26 + rand() * 18, bz + sz], b % 2 ? shade : white);
    }
  }
  // fbm is referenced by terrain; keep the import surface honest for the outline.
  void fbm2;
}
