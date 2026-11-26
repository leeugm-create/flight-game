// Coral Skylark — the ring course: ten glowing gates in a loop around
// Kestrel Bay, flown in order, then home to the runway.

import { normalize3, sub3 } from './math3d.js';

// position [x, y, z]; the ring's facing is derived from its neighbours so
// the course reads as one continuous line through the sky.
const RING_POSITIONS = [
  [-1250, 235, 1050],
  [-1950, 330, -150],
  [-1250, 430, -1250],
  [-150, 390, -1750],
  [950, 320, -1350],
  [1650, 260, -350],
  [1500, 205, 750],
  [650, 165, 1250],
  [-350, 150, 1350],
  [-950, 195, 1150],
];

export const RING_RADIUS = 34;

export function createRings() {
  return RING_POSITIONS.map((pos, i) => {
    const prev = RING_POSITIONS[(i + RING_POSITIONS.length - 1) % RING_POSITIONS.length];
    const next = RING_POSITIONS[(i + 1) % RING_POSITIONS.length];
    return {
      index: i,
      pos,
      normal: normalize3(sub3(next, prev)),
      radius: RING_RADIUS,
      passed: false,
    };
  });
}

export function nextRing(rings) {
  return rings.find((r) => !r.passed) || null;
}

// A pass counts when the plane crosses the ring's plane inside the hoop,
// travelling the course's way. Returns 0 (miss), 1 (through), 2 (centred).
export function checkRingPass(ring, prevPos, pos) {
  const before = signedDistance(ring, prevPos);
  const after = signedDistance(ring, pos);
  if (before === 0 || after === 0 || Math.sign(before) === Math.sign(after)) return 0;
  const t = before / (before - after);
  const cross = [
    prevPos[0] + (pos[0] - prevPos[0]) * t,
    prevPos[1] + (pos[1] - prevPos[1]) * t,
    prevPos[2] + (pos[2] - prevPos[2]) * t,
  ];
  const off = Math.hypot(cross[0] - ring.pos[0], cross[1] - ring.pos[1], cross[2] - ring.pos[2]);
  if (off > ring.radius) return 0;
  return off < ring.radius * 0.42 ? 2 : 1;
}

function signedDistance(ring, p) {
  return (p[0] - ring.pos[0]) * ring.normal[0] +
         (p[1] - ring.pos[1]) * ring.normal[1] +
         (p[2] - ring.pos[2]) * ring.normal[2];
}
