// Coral Skylark — entry point: builds the world, runs the game loop,
// works the cameras (chase and cockpit), keeps the HUD honest, and stages
// the deterministic ?shot= scenes the screenshots are taken from.

import { RUNWAY, SORTIE } from './config.js';
import { clamp, lerp, add3, scale3, forwardFromHeadingPitch, rightFromHeading, mat4Identity, mat4Multiply, mat4FromFlightState } from './math3d.js';
import { Renderer, GeometryBuilder, buildSkyGeometry, buildSunGeometry } from './render3d.js';
import { buildTerrainGeometry, buildSeaGeometry } from './terrain.js';
import { buildRunwayGeometry, buildTownGeometry, buildLighthouseGeometry, buildTreesGeometry, buildBuoysGeometry, buildCloudsGeometry } from './scenery.js';
import { buildPlaneGeometry, buildPropGeometry, buildRingGeometry } from './plane.js';
import { createRings, nextRing } from './rings.js';
import { createSortie, resetSortie, stepFlight, headingDeg, altitudeFt, speedKt } from './flight.js';
import { createInput } from './input.js';
import { createPanel } from './cockpit.js';
import { createAudio } from './audio.js';
import { readShotName, stageShot } from './shots.js';

const glCanvas = document.getElementById('gl');
const panelCanvas = document.getElementById('panel');
const renderer = new Renderer(glCanvas);
const panel = createPanel(panelCanvas);
const input = createInput();
input.attach(window);
const audio = createAudio();

// ---- World meshes -------------------------------------------------------
const worldBuilder = new GeometryBuilder();
buildTerrainGeometry(worldBuilder);
buildSeaGeometry(worldBuilder);
buildRunwayGeometry(worldBuilder);
buildTreesGeometry(worldBuilder);
const glowBuilder = new GeometryBuilder();
buildCloudsGeometry(glowBuilder);
buildTownGeometry(worldBuilder, glowBuilder);
buildLighthouseGeometry(worldBuilder, glowBuilder);
buildBuoysGeometry(worldBuilder, glowBuilder);
const worldMesh = renderer.upload(worldBuilder);
const glowMesh = renderer.upload(glowBuilder);

const skyBuilder = new GeometryBuilder();
buildSkyGeometry(skyBuilder);
const skyMesh = renderer.upload(skyBuilder);
const sunBuilder = new GeometryBuilder();
buildSunGeometry(sunBuilder);
const sunMesh = renderer.upload(sunBuilder);

const planeMesh = renderer.upload(buildPlaneGeometry());
const propMesh = renderer.upload(buildPropGeometry());

// ---- Sortie state -------------------------------------------------------
const sortie = createSortie();
sortie.rings = createRings();
let cameraMode = 'chase';
let paused = false;
let shotMode = null;

const shotName = readShotName();

// ---- HUD ----------------------------------------------------------------
const el = (id) => document.getElementById(id);
const hudEls = {
  hud: el('hud'), alt: el('hud-alt'), spd: el('hud-spd'), hdg: el('hud-hdg'),
  score: el('hud-score'), rings: el('hud-rings'), time: el('hud-time'),
  fuelFill: el('fuel-fill'), arrow: el('ring-arrow'), dist: el('ring-dist'),
  message: el('hud-message'), warn: el('hud-warn'),
};

function guideTarget() {
  const ring = nextRing(sortie.rings);
  if (ring) return { pos: ring.pos, label: `RING ${ring.index + 1}` };
  return { pos: [RUNWAY.centerX - RUNWAY.halfLength + 30, RUNWAY.elevation, RUNWAY.centerZ], label: 'RUNWAY' };
}

function updateHUD() {
  hudEls.alt.textContent = altitudeFt(sortie);
  hudEls.spd.textContent = speedKt(sortie);
  hudEls.hdg.textContent = String(Math.round(headingDeg(sortie))).padStart(3, '0');
  hudEls.score.textContent = sortie.score;
  hudEls.rings.textContent = `${sortie.ringsPassed}/${SORTIE.ringCount}`;
  const t = Math.max(0, Math.ceil(sortie.timeLeft));
  hudEls.time.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  hudEls.fuelFill.style.width = `${sortie.fuel}%`;
  hudEls.fuelFill.className = sortie.fuel > 30 ? '' : sortie.fuel > 12 ? 'low' : 'critical';
  const target = guideTarget();
  const dx = target.pos[0] - sortie.pos[0];
  const dz = target.pos[2] - sortie.pos[2];
  const bearing = Math.atan2(dx, -dz);
  let rel = bearing - sortie.heading;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  hudEls.arrow.style.transform = `rotate(${rel}rad)`;
  const dist = Math.round(Math.hypot(dx, dz));
  hudEls.dist.textContent = `${target.label} · ${dist} m`;
  hudEls.message.textContent = sortie.messageT > 0 ? sortie.message : '';
  hudEls.message.classList.toggle('show', sortie.messageT > 0);
  hudEls.warn.textContent = sortie.phase === 'flying' ? (sortie.warning || '') : '';
}

// ---- End screens ----------------------------------------------------------
function showEndScreen(title, note) {
  el('end-title').textContent = title;
  el('end-rings').textContent = `${sortie.ringsPassed} / ${SORTIE.ringCount}`;
  el('end-ring-points').textContent = sortie.ringPoints;
  el('end-landing').textContent = title === 'SORTIE COMPLETE' || sortie.phase === 'landed' ? SORTIE.landingBonus : 0;
  el('end-fuel').textContent = `${Math.round(sortie.fuel)}%`;
  el('end-hull').textContent = `${Math.round(sortie.hull)}%`;
  el('end-score').textContent = sortie.score;
  el('end-note').textContent = note;
  el('end-screen').classList.remove('hidden');
  hudEls.hud.classList.add('hidden');
}

function hideEndScreen() {
  el('end-screen').classList.add('hidden');
  hudEls.hud.classList.remove('hidden');
}

function finishSortie() {
  if (sortie.phase === 'landed') {
    audio.landed();
    showEndScreen('SORTIE COMPLETE', 'Down in one piece on the Kestrel Bay strip. The bay is yours.');
  } else if (sortie.phase === 'crashed') {
    audio.crash();
    showEndScreen('SORTIE OVER', sortie.crashReason || 'She went in.');
  } else if (sortie.phase === 'timeup') {
    showEndScreen('TIME UP', 'The light is gone. Whatever you scored is what you keep.');
  }
}

// ---- Shot staging (after the HUD helpers exist) ---------------------------
if (shotName) {
  const staged = stageShot(shotName, sortie);
  cameraMode = staged.camera;
  shotMode = staged;
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  if (staged.endScreen) showEndScreen(staged.endScreen.title, staged.endScreen.note);
}

// ---- Cameras --------------------------------------------------------------
const camPos = [sortie.pos[0] - 30, sortie.pos[1] + 12, sortie.pos[2] + 30];
let titleOrbit = 0;

function cameraFor(dt, nowSec) {
  const s = sortie;
  const fwd = forwardFromHeadingPitch(s.heading, s.pitch);
  const right = rightFromHeading(s.heading);
  if (s.phase === 'title' && !shotMode) {
    titleOrbit += dt * 0.07;
    const cx = s.pos[0] + Math.cos(titleOrbit) * 60;
    const cz = s.pos[2] + Math.sin(titleOrbit) * 60;
    return { eye: [cx, s.pos[1] + 16, cz], target: [s.pos[0], s.pos[1] + 2, s.pos[2]] };
  }
  if (cameraMode === 'cockpit') {
    const eye = add3(add3(s.pos, scale3(fwd, 1.2)), [0, 2.1, 0]);
    const target = add3(add3(eye, scale3(fwd, 120)), [0, -4.5, 0]);
    return { eye, target };
  }
  void right;
  const desired = add3(add3(s.pos, scale3(fwd, -27)), [0, 9.5, 0]);
  const k = shotMode ? 1 : 1 - Math.pow(0.0015, dt);
  camPos[0] = lerp(camPos[0], desired[0], k);
  camPos[1] = lerp(camPos[1], desired[1], k);
  camPos[2] = lerp(camPos[2], desired[2], k);
  const target = add3(add3(s.pos, scale3(fwd, 42)), [0, 2, 0]);
  void nowSec;
  return { eye: [camPos[0], camPos[1], camPos[2]], target };
}

// ---- Rendering --------------------------------------------------------------
const IDENTITY = mat4Identity();
const RING_TINTS = {
  passed: [0.30, 0.85, 0.40],
  waiting: [0.30, 0.78, 1.00],
};

const ringMeshes = sortie.rings.map((ring) => renderer.upload(buildRingGeometry(ring)));

// ---- Main loop ---------------------------------------------------------------
let lastMs = performance.now();
let framesRendered = 0;

function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = clamp((nowMs - lastMs) / 1000, 0.001, 0.05);
  lastMs = nowMs;
  const nowSec = nowMs / 1000;

  for (const ev of input.takeEvents()) {
    if (ev === 'camera' && sortie.phase === 'flying') {
      cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
    } else if (ev === 'mute') {
      audio.setMuted(!audio.isMuted());
    } else if (ev === 'pause' && (sortie.phase === 'flying')) {
      paused = !paused;
      el('pause-screen').classList.toggle('hidden', !paused);
    } else if (ev === 'confirm') {
      audio.unlock();
      if (sortie.phase === 'title') {
        el('title-screen').classList.add('hidden');
        hudEls.hud.classList.remove('hidden');
        resetSortie(sortie);
      } else if (sortie.phase === 'landed' || sortie.phase === 'crashed' || sortie.phase === 'timeup') {
        hideEndScreen();
        resetSortie(sortie);
      }
    }
  }

  if (!shotMode && !paused && sortie.phase === 'flying') {
    const events = stepFlight(sortie, input.poll(), dt);
    for (const ev of events) {
      if (ev === 'ring') audio.ring();
      if (ev === 'thud') audio.thud();
    }
    if (sortie.phase !== 'flying') finishSortie();
  }
  resizeIfNeeded();
  renderWithCamera(dt, nowSec);
  if (sortie.phase !== 'title') updateHUD();
  audio.update(sortie.throttle, sortie.speed, sortie.phase === 'flying');
  framesRendered++;
  if (shotMode && framesRendered > 24) window.__shotReady = true;
}

// cameraFor needs dt for smoothing; render() uses a zero-dt peek, so the
// loop drives the real camera here and render() re-reads the same state.
let activeCam = null;
function renderWithCamera(dt, nowSec) {
  activeCam = cameraFor(dt, nowSec);
  const s = sortie;
  const aspect = glCanvas.width / glCanvas.height;
  renderer.beginFrame(activeCam.eye, activeCam.target, aspect);
  renderer.drawFlat(skyMesh, IDENTITY, { fog: 0 });
  renderer.drawFlat(sunMesh, IDENTITY, { fog: 0 });
  renderer.drawLit(worldMesh, IDENTITY);
  renderer.drawFlat(glowMesh, IDENTITY, { fog: 1 });
  const next = nextRing(s.rings);
  s.rings.forEach((ring, i) => {
    let tint = ring.passed ? RING_TINTS.passed : RING_TINTS.waiting;
    if (ring === next) {
      const pulse = 0.82 + 0.35 * Math.sin(nowSec * 4);
      tint = [pulse, 0.74 * pulse, 0.18 * pulse];
    }
    renderer.drawFlat(ringMeshes[i], IDENTITY, { tint });
  });
  if (cameraMode !== 'cockpit') {
    const model = mat4FromFlightState(s.pos, s.heading, s.pitch, s.roll);
    renderer.drawLit(planeMesh, model);
    const spin = mat4FromFlightState([0, 0, 0], 0, 0, nowSec * (6 + s.throttle * 40));
    renderer.drawFlat(propMesh, mat4Multiply(model, spin), { alpha: 0.5, fog: 0 });
  }
  panel.draw(s, cameraMode);
}

function resizeIfNeeded() {
  const w = window.innerWidth, h = window.innerHeight;
  if (glCanvas.width !== w || glCanvas.height !== h) {
    glCanvas.width = w; glCanvas.height = h;
    panelCanvas.width = w; panelCanvas.height = h;
  }
}

resizeIfNeeded();
requestAnimationFrame(frame);
