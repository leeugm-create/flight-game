// Coral Skylark — the flight model and the sortie: a forgiving arcade
// model (throttle sets speed, bank turns the nose, slow flight stalls and
// sinks) wrapped in the mission rules — ten rings, a fuel gauge that
// matters, hull damage, and a runway that pays for a gentle arrival.

import { PLANE_SPEC, SORTIE } from './config.js';
import { clamp, forwardFromHeadingPitch } from './math3d.js';
import { heightAt, isOverRunway } from './terrain.js';
import { createRings, nextRing, checkRingPass } from './rings.js';

const DEG = Math.PI / 180;

export function createSortie() {
  return {
    phase: 'title',           // title | flying | paused | landed | crashed | timeup
    pos: [-1150, 235, 1150],
    heading: 55 * DEG,
    pitch: 0,
    roll: 0,
    speed: PLANE_SPEC.cruiseSpeed,
    throttle: PLANE_SPEC.startThrottle,
    fuel: SORTIE.startFuel,
    hull: 100,
    score: 0,
    ringPoints: 0,
    ringsPassed: 0,
    rings: createRings(),
    timeLeft: SORTIE.durationSec,
    elapsed: 0,
    message: '',
    messageT: 0,
    warning: '',
    engineOut: false,
    touchdownDone: false,
  };
}

export function resetSortie(s) {
  const fresh = createSortie();
  Object.assign(s, fresh);
  s.phase = 'flying';
}

export function headingDeg(s) {
  const d = (s.heading / DEG) % 360;
  return d < 0 ? d + 360 : d;
}

export function altitudeFt(s) { return Math.max(0, Math.round(s.pos[1] * 3.281)); }
export function speedKt(s) { return Math.round(s.speed * 1.944); }

// One simulation step. input: {pitch, roll, rudder, throttleDelta} in
// -1..1 style axes from input.js. Returns events for sound and messages.
export function stepFlight(s, input, dt) {
  const events = [];
  if (s.phase !== 'flying') return events;
  s.elapsed += dt;
  s.timeLeft = Math.max(0, SORTIE.durationSec - s.elapsed);
  if (s.messageT > 0) s.messageT -= dt;

  // Throttle and engine.
  s.throttle = clamp(s.throttle + input.throttleDelta * dt * 0.55, 0, 1);
  if (s.fuel <= 0) { s.fuel = 0; s.engineOut = true; }
  const power = s.engineOut ? 0 : s.throttle;
  s.fuel = Math.max(0, s.fuel - dt * (0.14 + power * 0.62));

  // Speed chases the throttle setting, slower when climbing.
  const target = PLANE_SPEC.minSpeed + power * (PLANE_SPEC.maxSpeed - PLANE_SPEC.minSpeed);
  const climbDrag = Math.sin(s.pitch) * 14;
  s.speed += clamp(target - climbDrag - s.speed, -9 * dt, 5.2 * dt);
  s.speed = clamp(s.speed, 9, PLANE_SPEC.maxSpeed + 6);

  // Controls: pitch and bank ease toward the stick, rudder nudges heading.
  const pitchRate = 0.85, rollRate = 1.9;
  s.pitch += clamp(input.pitch * 0.62 - s.pitch, -pitchRate * dt, pitchRate * dt);
  s.roll += clamp(input.roll * 1.05 - s.roll, -rollRate * dt, rollRate * dt);
  const turnAuthority = clamp(s.speed / PLANE_SPEC.cruiseSpeed, 0.35, 1.25);
  s.heading -= Math.sin(s.roll) * 0.62 * turnAuthority * dt;
  s.heading += input.rudder * 0.22 * turnAuthority * dt;
  // A banked wing also drops the nose a touch; pitch bleeds in a steep turn.
  s.pitch -= Math.abs(Math.sin(s.roll)) * 0.10 * dt * Math.sign(s.pitch + 0.001);

  // Stall: below stall speed she mushes downward and the nose falls.
  let sink = 0;
  if (s.speed < PLANE_SPEC.stallSpeed) {
    const stall = (PLANE_SPEC.stallSpeed - s.speed) / PLANE_SPEC.stallSpeed;
    sink = stall * 11;
    s.pitch -= stall * 0.35 * dt;
    s.warning = 'STALL';
  } else if (s.fuel <= 12 && !s.engineOut) {
    s.warning = 'LOW FUEL';
  } else if (s.engineOut) {
    s.warning = 'ENGINE OUT — GLIDE';
  } else {
    s.warning = '';
  }

  // Move.
  const prevPos = [s.pos[0], s.pos[1], s.pos[2]];
  const fwd = forwardFromHeadingPitch(s.heading, s.pitch);
  s.pos[0] += fwd[0] * s.speed * dt;
  s.pos[1] += fwd[1] * s.speed * dt - sink * dt;
  s.pos[2] += fwd[2] * s.speed * dt;
  s.verticalSpeed = (s.pos[1] - prevPos[1]) / Math.max(dt, 0.001);

  // Rings.
  const ring = nextRing(s.rings);
  if (ring) {
    const pass = checkRingPass(ring, prevPos, s.pos);
    if (pass > 0) {
      ring.passed = true;
      s.ringsPassed++;
      const gained = SORTIE.ringPoints + (pass === 2 ? SORTIE.ringCenterBonus : 0);
      s.ringPoints += gained;
      s.score += gained;
      s.message = pass === 2 ? `RING ${s.ringsPassed} — CENTRED +${gained}` : `RING ${s.ringsPassed} +${gained}`;
      s.messageT = 1.6;
      events.push('ring');
      if (!nextRing(s.rings)) {
        s.message = 'ALL RINGS — NOW LAND AT THE STRIP';
        s.messageT = 2.6;
      }
    }
  }

  // Ground and water.
  const ground = heightAt(s.pos[0], s.pos[2]);
  const clearance = s.pos[1] - ground;
  if (s.pos[1] <= 1.2 && ground < 0) {
    return crash(s, events, 'DITCHED IN THE BAY');
  }
  if (clearance <= 1.6) {
    const onRunway = isOverRunway(s.pos[0], s.pos[2]);
    const gentle = s.verticalSpeed > -4.2 && s.speed < 40 && Math.abs(s.roll) < 0.3;
    if (onRunway && gentle && !s.touchdownDone) {
      s.touchdownDone = true;
      s.phase = 'landed';
      s.pos[1] = ground + 1.6;
      s.score += SORTIE.landingBonus;
      events.push('landed');
      return events;
    }
    if (onRunway && s.verticalSpeed > -7 && s.speed < 52) {
      // A firm arrival on the strip: bounce, scrape, carry on if she can.
      s.hull -= 18;
      s.pos[1] = ground + 2.2;
      s.pitch = Math.max(s.pitch, 0.06);
      s.message = 'HEAVY LANDING — HULL DAMAGED';
      s.messageT = 2;
      events.push('thud');
      if (s.hull <= 0) return crash(s, events, 'SHE CAME APART ON THE STRIP');
    } else {
      return crash(s, events, ground <= 0 ? 'DITCHED IN THE BAY' : 'INTO THE GROUND');
    }
  }

  if (s.timeLeft <= 0 && s.phase === 'flying') {
    s.phase = 'timeup';
    events.push('timeup');
  }
  return events;
}

function crash(s, events, why) {
  s.phase = 'crashed';
  s.hull = 0;
  s.crashReason = why;
  events.push('crash');
  return events;
}
