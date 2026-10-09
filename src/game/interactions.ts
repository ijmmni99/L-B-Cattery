import * as THREE from 'three';

export interface Interactable {
  /** World position of the object's base. */
  position: THREE.Vector3;
  /** Rough size: how far off-centre the aim may be and still hit. */
  radius: number;
  /** Height above `position` to aim at (object centre). */
  aimHeight?: number;
  /** Button label, or null when this can't be used right now. */
  label(): string | null;
  act(): void;
}

/** Max distance from the eye to an object to use it. */
export const REACH = 2.6;
/** Aim slack added to every object's radius. */
const AIM_SLACK = 0.12;

const tmp = new THREE.Vector3();

/**
 * Picks what the crosshair is on: the object whose centre is closest to the
 * view ray (perpendicular distance), within reach.
 */
export class InteractionSystem {
  private readonly items = new Set<Interactable>();
  current: Interactable | null = null;

  add(item: Interactable): void {
    this.items.add(item);
  }

  remove(item: Interactable): void {
    this.items.delete(item);
    if (this.current === item) this.current = null;
  }

  update(eye: THREE.Vector3, dir: THREE.Vector3): Interactable | null {
    let best: Interactable | null = null;
    let bestScore = Infinity;
    for (const item of this.items) {
      if (item.label() === null) continue;
      tmp.copy(item.position);
      tmp.y += item.aimHeight ?? 0;
      tmp.sub(eye);
      const along = tmp.dot(dir);
      if (along <= 0) continue;
      const dist = tmp.length();
      if (dist > REACH + item.radius) continue;
      const perp = Math.sqrt(Math.max(dist * dist - along * along, 0));
      if (perp > item.radius + AIM_SLACK) continue;
      const score = perp + dist * 0.05;
      if (score < bestScore) {
        bestScore = score;
        best = item;
      }
    }
    this.current = best;
    return best;
  }

  trigger(): boolean {
    if (!this.current || this.current.label() === null) return false;
    this.current.act();
    return true;
  }
}
