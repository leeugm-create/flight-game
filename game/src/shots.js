// Coral Skylark — screenshot staging. Opening the game with ?shot=<name>
// freezes the simulation in one composed, deterministic mid-game moment
// so the maker's screenshots are real renders of the game's own code:
//   cover   — chase view, banked toward the next gold ring over the coast
//   cockpit — cockpit view on final approach, gauges lit, runway ahead
//   runway  — chase view low on final, the strip filling the windscreen
//   score   — the sortie results screen over a scenic banked turn

const DEG = Math.PI / 180;

export function readShotName() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot');
}

function markRingsPassed(s, count) {
  s.rings.forEach((ring, i) => { ring.passed = i < count; });
  s.ringsPassed = count;
}

export function stageShot(name, s) {
  s.phase = 'flying';
  if (name === 'cockpit') {
    s.pos = [-980, 82, 620];
    s.heading = 90 * DEG;
    s.pitch = -0.045;
    s.roll = 0.02;
    s.speed = 34;
    s.throttle = 0.35;
    s.fuel = 38;
    s.verticalSpeed = -1.8;
    markRingsPassed(s, 10);
    s.ringPoints = 1025;
    s.score = 1025;
    s.timeLeft = 96;
    return { camera: 'cockpit', endScreen: null };
  }
  if (name === 'runway') {
    s.pos = [-700, 56, 626];
    s.heading = 90 * DEG;
    s.pitch = -0.05;
    s.roll = -0.03;
    s.speed = 36;
    s.throttle = 0.3;
    s.fuel = 41;
    s.verticalSpeed = -2.1;
    markRingsPassed(s, 10);
    s.ringPoints = 1025;
    s.score = 1025;
    s.timeLeft = 88;
    return { camera: 'chase', endScreen: null };
  }
  if (name === 'score') {
    s.pos = [900, 265, 950];
    s.heading = 205 * DEG;
    s.pitch = 0.02;
    s.roll = 0.38;
    s.speed = 48;
    s.throttle = 0.58;
    s.fuel = 23;
    s.hull = 92;
    markRingsPassed(s, 8);
    s.ringPoints = 825;
    s.score = 1325;
    s.timeLeft = 0;
    return {
      camera: 'chase',
      endScreen: {
        title: 'SORTIE COMPLETE',
        note: 'Eight rings, then a greased landing on the Kestrel Bay strip.',
      },
    };
  }
  // cover (default)
  s.pos = [380, 178, 1520];
  s.heading = 45 * DEG;
  s.pitch = -0.03;
  s.roll = -0.5;
  s.speed = 52;
  s.throttle = 0.7;
  s.fuel = 64;
  s.verticalSpeed = -0.6;
  markRingsPassed(s, 7);
  s.ringPoints = 725;
  s.score = 725;
  s.timeLeft = 212;
  return { camera: 'chase', endScreen: null };
}
