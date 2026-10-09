import type { FirstPersonCamera } from '../core/fp-camera';

/** Share of the screen width (from the left) that belongs to the joystick. */
export const LOOK_ZONE_START = 0.45;
const TAP_MAX_MOVE = 12;
const TAP_MAX_MS = 300;
const CENTER_TAP_RADIUS = 80;

/**
 * Look controls.
 * Touch: drag on the right part of the screen (left is the joystick).
 *   A quick tap near the screen centre (the crosshair) triggers `onTap`.
 * Desktop: first click locks the pointer, then the mouse looks around and
 *   each click interacts; Esc releases. Plain dragging also works unlocked.
 */
export function setupLookInput(canvas: HTMLCanvasElement, fp: FirstPersonCamera, onTap: () => void): void {
  const drags = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; moved: number }>();
  const coarse = matchMedia('(pointer: coarse)').matches;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && !coarse) {
      if (document.pointerLockElement === canvas) {
        onTap();
        return;
      }
      canvas.requestPointerLock?.();
    } else if (e.clientX < innerWidth * LOOK_ZONE_START && !nearCenter(e)) {
      return; // left side belongs to the joystick
    }
    drags.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 });
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Not capturable while pointer lock is engaging; lock delivers moves anyway.
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (document.pointerLockElement === canvas) {
      fp.addLook(e.movementX, e.movementY, 0.55);
      return;
    }
    const d = drags.get(e.pointerId);
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved += Math.abs(dx) + Math.abs(dy);
    // Touch drags feel slower than mouse; boost a little.
    fp.addLook(dx, dy, e.pointerType === 'touch' ? 1.15 : 1);
    d.x = e.clientX;
    d.y = e.clientY;
  });

  const end = (e: PointerEvent): void => {
    const d = drags.get(e.pointerId);
    drags.delete(e.pointerId);
    if (!d || e.type === 'pointercancel') return;
    const quick = performance.now() - d.t < TAP_MAX_MS && d.moved < TAP_MAX_MOVE;
    if (quick && e.pointerType !== 'mouse' && nearCenter(e)) onTap();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

function nearCenter(e: PointerEvent): boolean {
  return Math.hypot(e.clientX - innerWidth / 2, e.clientY - innerHeight / 2) < CENTER_TAP_RADIUS;
}
