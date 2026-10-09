import type { Input } from '../core/input';

const RADIUS = 56;
const DEAD_ZONE = 0.12;

/**
 * Floating virtual joystick on the left part of the screen. The base appears
 * where the thumb lands; at rest a faint hint sits in the default spot.
 */
export function createJoystick(parent: HTMLElement, input: Input): void {
  const zone = document.createElement('div');
  zone.className = 'joystick-zone';
  const base = document.createElement('div');
  base.className = 'joystick-base';
  const knob = document.createElement('div');
  knob.className = 'joystick-knob';
  base.appendChild(knob);
  zone.appendChild(base);
  parent.appendChild(zone);

  let pointerId: number | null = null;
  let cx = 0;
  let cy = 0;

  const rest = (): void => {
    base.classList.remove('active');
    base.style.left = '';
    base.style.top = '';
    knob.style.transform = 'translate(-50%, -50%)';
    input.setJoystick(0, 0, false);
  };

  zone.addEventListener('pointerdown', (e) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect();
    cx = e.clientX;
    cy = e.clientY;
    base.classList.add('active');
    base.style.left = `${cx - r.left}px`;
    base.style.top = `${cy - r.top}px`;
    input.setJoystick(0, 0, true);
    e.preventDefault();
  });

  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    let mx = dx / RADIUS;
    let my = -dy / RADIUS;
    const m = Math.hypot(mx, my);
    if (m < DEAD_ZONE) {
      mx = 0;
      my = 0;
    } else {
      // Rescale past the dead zone so small pushes still feel analogue.
      const k = (m - DEAD_ZONE) / (1 - DEAD_ZONE) / m;
      mx *= k;
      my *= k;
    }
    input.setJoystick(mx, my, true);
  });

  const end = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    rest();
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  rest();
}
