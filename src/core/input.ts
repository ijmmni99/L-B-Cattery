import * as THREE from 'three';

const KEY_DIRS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/**
 * Unified input. `move` is screen-relative: x = right, y = up (forward),
 * magnitude 0..1. Joystick wins over keyboard while it is held.
 */
export class Input {
  readonly move = new THREE.Vector2();
  private readonly keys = new Set<string>();
  private readonly joystick = new THREE.Vector2();
  private joystickActive = false;
  private readonly downListeners: Array<() => void> = [];
  private readonly upListeners: Array<() => void> = [];
  private actionHeld = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.actionDown();
        return;
      }
      if (e.code in KEY_DIRS) {
        e.preventDefault();
        this.keys.add(e.code);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') this.actionUp();
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.actionUp();
    });
  }

  setJoystick(x: number, y: number, active: boolean): void {
    this.joystick.set(x, y);
    this.joystickActive = active;
  }

  /** Action button / E pressed. */
  onActionDown(fn: () => void): void {
    this.downListeners.push(fn);
  }

  /** Action button / E released. */
  onActionUp(fn: () => void): void {
    this.upListeners.push(fn);
  }

  actionDown(): void {
    if (this.actionHeld) return;
    this.actionHeld = true;
    for (const fn of this.downListeners) fn();
  }

  actionUp(): void {
    if (!this.actionHeld) return;
    this.actionHeld = false;
    for (const fn of this.upListeners) fn();
  }

  /** Call once per frame before reading `move`. */
  update(): void {
    if (this.joystickActive) {
      this.move.copy(this.joystick);
      return;
    }
    this.move.set(0, 0);
    for (const code of this.keys) {
      const d = KEY_DIRS[code];
      this.move.x += d[0];
      this.move.y += d[1];
    }
    if (this.move.lengthSq() > 1) this.move.normalize();
  }
}
