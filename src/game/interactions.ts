import * as THREE from 'three';

export interface Interactable {
  /** World position used for range checks (y ignored). */
  position: THREE.Vector3;
  /** Extra reach for big objects. */
  radius: number;
  /** Button label, or null when this can't be used right now. */
  label(): string | null;
  act(): void;
}

const REACH = 1.1;
const tmp = new THREE.Vector3();

/** Finds the best interactable in front of the player each frame. */
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

  update(playerPos: THREE.Vector3, facing: number): Interactable | null {
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    let best: Interactable | null = null;
    let bestScore = Infinity;
    for (const item of this.items) {
      if (item.label() === null) continue;
      tmp.subVectors(item.position, playerPos).setY(0);
      const dist = tmp.length();
      if (dist > REACH + item.radius) continue;
      // Prefer things in front of the player; behind costs extra.
      const dot = dist > 1e-4 ? (tmp.x * fx + tmp.z * fz) / dist : 1;
      if (dot < -0.2) continue;
      const score = dist - item.radius + (1 - dot) * 0.6;
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
