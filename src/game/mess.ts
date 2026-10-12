import * as THREE from 'three';
import { MESS } from '../config/care';
import { cachedGeometry, mesh, pastel } from '../core/cache';
import { haptic } from '../core/haptics';
import type { Interactable, InteractionSystem } from './interactions';
import { addXp } from './state';

export interface Mess {
  x: number;
  z: number;
  group: THREE.Group;
  item: Interactable;
  /** A staff member is on the way. */
  claimed: boolean;
}

/** Litter and spills customers leave on the floor. Left alone, they put people off visiting. */
export class MessSystem {
  readonly messes: Mess[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly interactions: InteractionSystem,
  ) {}

  get count(): number {
    return this.messes.length;
  }

  drop(x: number, z: number): void {
    if (this.messes.length >= MESS.max) return;
    const group = new THREE.Group();
    if (Math.random() < 0.5) {
      const paper = mesh(cachedGeometry('mess-paper', () => new THREE.IcosahedronGeometry(0.06, 0)), pastel('#fbfbf6', 0.9));
      paper.position.y = 0.06;
      paper.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      group.add(paper);
    } else {
      const puddle = mesh(cachedGeometry('mess-puddle', () => new THREE.CylinderGeometry(0.17, 0.17, 0.006, 20)), pastel('#a9d4f5', 0.3), { cast: false });
      puddle.position.y = 0.004;
      puddle.scale.set(1 + Math.random() * 0.4, 1, 0.8 + Math.random() * 0.3);
      group.add(puddle);
    }
    group.position.set(x, 0, z);
    const proxy = new THREE.Mesh(
      cachedGeometry('mess-proxy', () => new THREE.SphereGeometry(0.28, 8, 6)),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    proxy.position.y = 0.05;
    group.add(proxy);
    const m: Mess = {
      x,
      z,
      group,
      claimed: false,
      item: {
        position: group.position,
        object: proxy,
        highlight: group.children[0],
        label: () => 'Clean up',
        act: () => this.clean(m, true),
      },
    };
    this.interactions.add(m.item);
    this.scene.add(group);
    this.messes.push(m);
  }

  clean(m: Mess, byPlayer = false): void {
    const i = this.messes.indexOf(m);
    if (i < 0) return;
    this.messes.splice(i, 1);
    this.interactions.remove(m.item);
    this.scene.remove(m.group);
    if (byPlayer) {
      haptic(8);
      addXp(1);
    }
  }

  /** Nearest unclaimed mess to a point. */
  nearest(x: number, z: number): Mess | null {
    let best: Mess | null = null;
    let bd = Infinity;
    for (const m of this.messes) {
      if (m.claimed) continue;
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }
}
