// Coral Skylark — keyboard and mouse input. Keys steer, W/S work the
// throttle, the mouse steers gently toward the cursor when it moves, and
// a few keys (camera, pause, mute, start) arrive as one-shot events.

export function createInput() {
  const keys = new Set();
  const input = {
    pitch: 0, roll: 0, rudder: 0, throttleDelta: 0,
    mouseX: 0, mouseY: 0, mouseActive: false,
    events: [],
    attach(target) {
      target.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        if (!e.repeat) {
          if (e.code === 'KeyC') input.events.push('camera');
          if (e.code === 'KeyP' || e.code === 'Escape') input.events.push('pause');
          if (e.code === 'KeyM') input.events.push('mute');
          if (e.code === 'Enter') input.events.push('confirm');
        }
        keys.add(e.code);
      });
      target.addEventListener('keyup', (e) => keys.delete(e.code));
      target.addEventListener('mousemove', (e) => {
        input.mouseX = (e.clientX / target.innerWidth) * 2 - 1;
        input.mouseY = (e.clientY / target.innerHeight) * 2 - 1;
        input.mouseActive = true;
      });
      target.addEventListener('mousedown', () => input.events.push('confirm'));
      target.addEventListener('blur', () => keys.clear());
    },
    // Reads the held keys (plus mouse) into the axes flight.js consumes.
    poll() {
      let pitch = 0, roll = 0, rudder = 0, throttleDelta = 0;
      if (keys.has('ArrowDown')) pitch += 1;       // stick back: climb
      if (keys.has('ArrowUp')) pitch -= 1;         // stick forward: descend
      if (keys.has('ArrowLeft')) roll -= 1;
      if (keys.has('ArrowRight')) roll += 1;
      if (keys.has('KeyA')) rudder -= 1;
      if (keys.has('KeyD')) rudder += 1;
      if (keys.has('KeyW')) throttleDelta += 1;
      if (keys.has('KeyS')) throttleDelta -= 1;
      if (pitch === 0 && roll === 0 && input.mouseActive) {
        roll = clampAxis(input.mouseX * 0.9);
        pitch = clampAxis(-input.mouseY * 0.55);
      }
      input.pitch = pitch;
      input.roll = roll;
      input.rudder = rudder;
      input.throttleDelta = throttleDelta;
      return input;
    },
    takeEvents() {
      const out = input.events.slice();
      input.events.length = 0;
      return out;
    },
  };
  return input;
}

function clampAxis(v) { return v < -1 ? -1 : v > 1 ? 1 : v; }
