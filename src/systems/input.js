import { Vector2 } from 'three';

// Keyboard-primary input (§5). The Chromebook dev machine means keyboard is the
// source of truth; gamepad is a later add. Edge-triggered "pressed" flags are
// consumed once per frame so buffering logic can react to a single press.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = new Vector2(); // accumulated look delta since last frame
    this.locked = false;

    // Semantic action state, refreshed each frame from raw keys.
    this.move = new Vector2(); // x = strafe, y = forward (camera-relative)
    this.lmbDown = false;
    this.rmbDown = false;

    this._bind();
  }

  _bind() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
    });
    addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.down.delete(k);
      this.released.add(k);
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.lmbDown = true;
        this.pressed.add('lmb');
      }
      if (e.button === 2) {
        this.rmbDown = true;
        this.pressed.add('rmb');
      }
      if (!this.locked) this.canvas.requestPointerLock?.();
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.lmbDown = false;
        this.released.add('lmb');
      }
      if (e.button === 2) {
        this.rmbDown = false;
        this.released.add('rmb');
      }
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouse.x += e.movementX;
        this.mouse.y += e.movementY;
      }
    });
  }

  // Call at the START of a frame, before systems read input.
  begin() {
    let x = 0;
    let y = 0;
    if (this.down.has('a')) x -= 1;
    if (this.down.has('d')) x += 1;
    if (this.down.has('w')) y += 1;
    if (this.down.has('s')) y -= 1;
    this.move.set(x, y);
    if (this.move.lengthSq() > 1) this.move.normalize();
  }

  // Call at the END of a frame to clear per-frame edges + look delta.
  end() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.set(0, 0);
  }

  isDown(k) {
    return this.down.has(k);
  }
  wasPressed(k) {
    return this.pressed.has(k);
  }

  // Shift = Knell-Lock (hold).
  get lockHeld() {
    return this.down.has('shift');
  }
}
