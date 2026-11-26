// Coral Skylark — all sound is synthesised with WebAudio: a two-oscillator
// engine whose pitch follows the throttle, filtered wind that follows the
// airspeed, a chime for a ring and a thud for bad news. No audio files.

export function createAudio() {
  let ctx = null;
  let engineOsc = null, engineOsc2 = null, engineGain = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();

    const noise = ctx.createBufferSource();
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 640;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    noise.start();
  }

  function tone(freq, dur, type = 'sine', vol = 0.16, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock() { ensure(); },
    setMuted(m) {
      muted = m;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
    },
    isMuted() { return muted; },
    update(throttle, speed, flying) {
      if (!ctx || muted) return;
      const rpm = 55 + throttle * 95;
      engineOsc.frequency.value = rpm;
      engineOsc2.frequency.value = rpm * 1.5 + 2;
      engineGain.gain.value = flying ? 0.028 + throttle * 0.05 : 0;
      windGain.gain.value = flying ? Math.min(0.11, speed / 900) : 0;
    },
    ring() { tone(880, 0.22, 'sine', 0.18); tone(1318, 0.34, 'sine', 0.16, 0.09); },
    thud() { tone(72, 0.3, 'triangle', 0.3); },
    crash() { tone(54, 0.7, 'sawtooth', 0.3); tone(40, 0.9, 'triangle', 0.3, 0.05); },
    landed() { tone(523, 0.2, 'sine', 0.15); tone(659, 0.2, 'sine', 0.15, 0.12); tone(784, 0.4, 'sine', 0.17, 0.24); },
  };
}
