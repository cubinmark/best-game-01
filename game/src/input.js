// Neon Harvest — input: keyboard state with edge detection, plus the
// mouse (position, held button, and clicks queued for the screens).
// The game asks this object what is held and what was just pressed;
// nothing in here knows the game's rules.

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'Space', 'Enter', 'Escape', 'KeyP', 'KeyR', 'KeyM',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();       // codes currently held
    this.pressed = new Set();    // codes that went down since last frame
    this.clicks = [];            // queued {x, y} in game coordinates
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.anyGesture = false;     // first click/key, for audio unlock

    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
      this.anyGesture = true;
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouseDown = false;
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = this.toGame(e);
      this.mouseX = p.x;
      this.mouseY = p.y;
    });
    canvas.addEventListener('pointerdown', (e) => {
      const p = this.toGame(e);
      this.mouseX = p.x;
      this.mouseY = p.y;
      this.mouseDown = true;
      this.anyGesture = true;
      this.clicks.push(p);
    });
    window.addEventListener('pointerup', () => {
      this.mouseDown = false;
    });
  }

  // Browser pixels to game coordinates (the canvas is CSS-scaled).
  toGame(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
    };
  }

  held(code) {
    return this.down.has(code);
  }

  // Edge-triggered: true once per physical press. Call once a frame,
  // before endFrame().
  justPressed(code) {
    return this.pressed.has(code);
  }

  thrustVector() {
    let x = 0;
    let y = 0;
    if (this.held('ArrowLeft') || this.held('KeyA')) x -= 1;
    if (this.held('ArrowRight') || this.held('KeyD')) x += 1;
    if (this.held('ArrowUp') || this.held('KeyW')) y -= 1;
    if (this.held('ArrowDown') || this.held('KeyS')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  takeClicks() {
    const out = this.clicks;
    this.clicks = [];
    return out;
  }

  endFrame() {
    this.pressed.clear();
  }
}
