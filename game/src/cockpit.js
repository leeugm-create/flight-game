// Coral Skylark — the instrument panel, drawn on a 2D canvas over the 3D
// view. Cockpit camera gets the full six-gauge panel with lit faces, a
// throttle quadrant and a fuel gauge; chase camera gets a compact cluster
// of the three primary gauges. Every needle is driven by live flight data.

import { clamp } from './math3d.js';
import { headingDeg, altitudeFt, speedKt } from './flight.js';

const FACE = '#10151c';
const BEZEL = '#2c3540';
const TICK = '#cfe3ee';
const NEEDLE = '#ffb347';
const RED = '#ff5d5d';
const GREEN = '#57e6a3';

export function createPanel(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    canvas,
    draw(state, mode) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (mode === 'cockpit') drawCockpit(ctx, canvas, state);
      else drawCluster(ctx, canvas, state);
    },
  };
}

function gaugeFace(ctx, x, y, r, label) {
  ctx.beginPath();
  ctx.arc(x, y, r + 5, 0, Math.PI * 2);
  ctx.fillStyle = BEZEL;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = FACE;
  ctx.fill();
  ctx.fillStyle = TICK;
  ctx.font = `700 ${Math.round(r * 0.2)}px Verdana, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + r * 0.8);
}

function needle(ctx, x, y, r, angle, color = NEEDLE, width = 3) {
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(angle) * r * 0.18, y - Math.sin(angle) * r * 0.18);
  ctx.lineTo(x + Math.cos(angle) * r * 0.86, y + Math.sin(angle) * r * 0.86);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function ticks(ctx, x, y, r, count, a0, a1, everyLabel) {
  ctx.strokeStyle = TICK;
  ctx.fillStyle = TICK;
  ctx.lineWidth = 2;
  ctx.font = `700 ${Math.round(r * 0.26)}px Verdana, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= count; i++) {
    const a = a0 + (a1 - a0) * (i / count);
    const inner = r * 0.78;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    ctx.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
    ctx.stroke();
    if (everyLabel && i % everyLabel === 0) {
      ctx.fillText(String(i / everyLabel), x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
    }
  }
  ctx.textBaseline = 'alphabetic';
}

// Airspeed: 0..180 kt over 270 degrees, green arc to 120, red past 150.
function drawAirspeed(ctx, x, y, r, kt) {
  gaugeFace(ctx, x, y, r, 'KNOTS');
  const a0 = Math.PI * 0.75, a1 = a0 + Math.PI * 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.88, a0 + (55 / 180) * (a1 - a0), a0 + (120 / 180) * (a1 - a0));
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = r * 0.1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.88, a0 + (150 / 180) * (a1 - a0), a1);
  ctx.strokeStyle = RED;
  ctx.stroke();
  ticks(ctx, x, y, r, 18, a0, a1, 3);
  needle(ctx, x, y, r, a0 + (clamp(kt, 0, 180) / 180) * (a1 - a0));
}

// Altimeter: long needle = hundreds of feet, short = thousands.
function drawAltimeter(ctx, x, y, r, ft) {
  gaugeFace(ctx, x, y, r, 'ALT FT');
  ticks(ctx, x, y, r, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, 1);
  const hundreds = (ft % 1000) / 1000;
  const thousands = (ft % 10000) / 10000;
  needle(ctx, x, y, r, -Math.PI / 2 + thousands * Math.PI * 2, '#8cdcff', 5);
  needle(ctx, x, y, r, -Math.PI / 2 + hundreds * Math.PI * 2);
}

// Attitude indicator: the horizon bar rolls and pitches with the plane.
function drawAttitude(ctx, x, y, r, pitch, roll) {
  gaugeFace(ctx, x, y, r, '');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.94, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-roll);
  const shift = clamp(pitch, -0.5, 0.5) * r * 1.5;
  ctx.fillStyle = '#3f7fbf';
  ctx.fillRect(-r, -r + shift, r * 2, r * 2);
  ctx.fillStyle = '#7a5a38';
  ctx.fillRect(-r, shift, r * 2, r * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, shift);
  ctx.lineTo(r, shift);
  ctx.stroke();
  for (const off of [-0.35, -0.18, 0.18, 0.35]) {
    const w = off % 0.3 === 0 ? r * 0.3 : r * 0.18;
    ctx.beginPath();
    ctx.moveTo(-w / 2, shift + off * r * 1.5);
    ctx.lineTo(w / 2, shift + off * r * 1.5);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed aircraft symbol.
  ctx.strokeStyle = NEEDLE;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y);
  ctx.lineTo(x - r * 0.14, y);
  ctx.lineTo(x - r * 0.14, y + r * 0.12);
  ctx.moveTo(x + r * 0.55, y);
  ctx.lineTo(x + r * 0.14, y);
  ctx.lineTo(x + r * 0.14, y + r * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.05, 0, Math.PI * 2);
  ctx.fillStyle = NEEDLE;
  ctx.fill();
}

// Heading compass: a rotating card under a fixed lubber line.
function drawHeading(ctx, x, y, r, hdg) {
  gaugeFace(ctx, x, y, r, 'HDG');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.94, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = TICK;
  ctx.font = `700 ${Math.round(r * 0.3)}px Verdana, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  for (let d = 0; d < 360; d += 30) {
    const a = ((d - hdg) * Math.PI) / 180 - Math.PI / 2;
    const px = x + Math.cos(a) * r * 0.68, py = y + Math.sin(a) * r * 0.68;
    ctx.fillText(names[d] || String(d / 10), px, py);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.02);
  ctx.lineTo(x - 6, y - r * 0.8);
  ctx.lineTo(x + 6, y - r * 0.8);
  ctx.closePath();
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.textBaseline = 'alphabetic';
}

// Vertical speed: -20..+20 (x100 ft/min shown as m/s here, -12..+12).
function drawVSI(ctx, x, y, r, vs) {
  gaugeFace(ctx, x, y, r, 'VERT');
  const a0 = Math.PI * 0.75, a1 = a0 + Math.PI * 1.5;
  ticks(ctx, x, y, r, 12, a0, a1, 3);
  needle(ctx, x, y, r, a0 + ((clamp(vs, -12, 12) + 12) / 24) * (a1 - a0));
}

// RPM / throttle quadrant gauge.
function drawThrottle(ctx, x, y, r, throttle) {
  gaugeFace(ctx, x, y, r, 'THROTTLE');
  const a0 = Math.PI * 0.75, a1 = a0 + Math.PI * 1.5;
  ticks(ctx, x, y, r, 10, a0, a1, 5);
  needle(ctx, x, y, r, a0 + throttle * (a1 - a0), GREEN);
}

// Fuel as a vertical bar gauge.
function drawFuel(ctx, x, y, w, h, fuel) {
  ctx.fillStyle = BEZEL;
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = FACE;
  ctx.fillRect(x, y, w, h);
  const fh = (fuel / 100) * h;
  ctx.fillStyle = fuel > 30 ? GREEN : fuel > 12 ? NEEDLE : RED;
  ctx.fillRect(x, y + h - fh, w, fh);
  ctx.fillStyle = TICK;
  ctx.font = '700 13px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FUEL', x + w / 2, y + h + 20);
}

function drawCockpit(ctx, canvas, s) {
  const W = canvas.width, H = canvas.height;
  // Glareshield and panel slab across the lower view.
  const panelTop = H * 0.56;
  ctx.fillStyle = '#141a21';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, panelTop + 40);
  ctx.quadraticCurveTo(W * 0.5, panelTop - 26, W, panelTop + 40);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1d262f';
  ctx.fillRect(0, panelTop + 50, W, H - panelTop);
  // A faint prop blur arc low over the cowling.
  ctx.beginPath();
  ctx.arc(W / 2, panelTop + 34, W * 0.13, Math.PI * 1.08, Math.PI * 1.92);
  ctx.strokeStyle = 'rgba(200,205,210,0.13)';
  ctx.lineWidth = 11;
  ctx.stroke();
  // Six gauges in two rows of three, plus fuel at the right side.
  const r = Math.min(W, H) * 0.07;
  const cy1 = panelTop + 50 + r + 10;
  const xs = [W * 0.30, W * 0.5, W * 0.70];
  drawAirspeed(ctx, xs[0], cy1, r, speedKt(s));
  drawAttitude(ctx, xs[1], cy1, r, s.pitch, s.roll);
  drawAltimeter(ctx, xs[2], cy1, r, altitudeFt(s));
  const cy2 = cy1 + r * 1.92 + 16;
  drawHeading(ctx, xs[0], cy2, r * 0.92, headingDeg(s));
  drawVSI(ctx, xs[1], cy2, r * 0.92, s.verticalSpeed || 0);
  drawThrottle(ctx, xs[2], cy2, r * 0.92, s.throttle);
  drawFuel(ctx, W * 0.865, panelTop + 66, 30, r * 2.4, s.fuel);
  // Warning annunciator.
  if (s.warning) {
    ctx.fillStyle = RED;
    ctx.font = '800 21px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.warning, W / 2, panelTop + 40);
  }
}

function drawCluster(ctx, canvas, s) {
  const W = canvas.width, H = canvas.height;
  const r = Math.min(W, H) * 0.062;
  const cy = H - r - 26;
  const xs = [W / 2 - r * 2.5, W / 2, W / 2 + r * 2.5];
  drawAirspeed(ctx, xs[0], cy, r, speedKt(s));
  drawAttitude(ctx, xs[1], cy, r, s.pitch, s.roll);
  drawAltimeter(ctx, xs[2], cy, r, altitudeFt(s));
}
