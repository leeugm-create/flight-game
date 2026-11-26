// Coral Skylark — shared constants: world layout, sortie rules, colours.
// Everything tunable lives here so the other modules stay declarative.

export const WORLD = {
  extent: 4200,          // terrain mesh spans -extent..extent on x and z
  seaLevel: 0,
  islandCenterX: -200,
  islandCenterZ: -300,
  islandRadius: 2500,
};

// The runway strip: flat, along the x axis, on the south shore of the island.
export const RUNWAY = {
  centerX: 0,
  centerZ: 620,
  halfLength: 450,       // usable strip is 900 m long
  halfWidth: 23,
  elevation: 16,
  headingDeg: 90,        // land toward the east (+x)
};

export const SORTIE = {
  durationSec: 300,
  ringCount: 10,
  ringPoints: 100,
  ringCenterBonus: 25,
  landingBonus: 500,
  startFuel: 100,
};

export const PLANE_SPEC = {
  minSpeed: 16,          // m/s, engine idle glide
  maxSpeed: 84,          // m/s at full throttle
  stallSpeed: 24,        // below this the nose drops and she sinks
  cruiseSpeed: 46,
  startThrottle: 0.62,
};

export const PALETTE = {
  skyTop: [0.16, 0.38, 0.66],
  skyHorizon: [0.83, 0.91, 0.97],
  fog: [0.78, 0.87, 0.94],
  sea: [0.10, 0.36, 0.52],
  seaDeep: [0.05, 0.24, 0.40],
  sand: [0.87, 0.78, 0.55],
  grass: [0.35, 0.58, 0.30],
  grassDry: [0.55, 0.62, 0.33],
  rock: [0.48, 0.45, 0.42],
  runway: [0.23, 0.23, 0.25],
  runwayMark: [0.95, 0.95, 0.92],
  coral: [0.98, 0.36, 0.24],
  cream: [0.98, 0.93, 0.82],
  darkMetal: [0.16, 0.17, 0.19],
};

export const SUN_DIR = norm3(0.45, 0.62, 0.35);

function norm3(x, y, z) {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}
