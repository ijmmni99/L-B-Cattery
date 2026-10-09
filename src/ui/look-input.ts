import type { FirstPersonCamera } from '../core/fp-camera';

/**
 * Look controls.
 * Touch: drag anywhere on the canvas that isn't a UI control.
 * Desktop: click to lock the pointer, then move the mouse (Esc releases);
 * dragging also works without the lock.
 */
export function setupLookInput(canvas: HTMLCanvasElement, fp: FirstPersonCamera): void {
  const drags = new Map<number, { x: number; y: number }>();
  const isMobile = matchMedia('(pointer: coarse)').matches;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && !isMobile && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
    drags.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
    // Touch drags feel slower than mouse; boost a little.
    fp.addLook(e.clientX - d.x, e.clientY - d.y, e.pointerType === 'touch' ? 1.15 : 1);
    d.x = e.clientX;
    d.y = e.clientY;
  });

  const end = (e: PointerEvent): void => {
    drags.delete(e.pointerId);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
