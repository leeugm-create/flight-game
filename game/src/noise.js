// Coral Skylark — deterministic value noise: the island is the same on
// every visit and in every screenshot, with no random seed at run time.

function hash2(ix, iz) {
  let h = ix * 374761393 + iz * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}

function fade(t) { return t * t * (3 - 2 * t); }

// Smooth value noise in [0, 1] from integer lattice hashes.
export function valueNoise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  const u = fade(fx), v = fade(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Fractal sum, roughly [0, 1], used for hills, colour variation and trees.
export function fbm2(x, z, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

// A tiny deterministic PRNG for placing scenery: same sequence every run.
export function seededRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
