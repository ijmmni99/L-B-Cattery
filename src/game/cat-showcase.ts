import * as THREE from 'three';
import type { CatActivityId } from '../config/cats';
import { cachedGeometry, mesh, pastel } from '../core/cache';
import { haptic } from '../core/haptics';
import type { RoamArea } from './cat-behavior';
import { generateCat } from './cat-data';
import { CatEntity } from './cat-entity';
import type { Interactable, InteractionSystem } from './interactions';
import type { CollisionWorld } from '../world/colliders';

/** One of each core breed first, then random extras. */
const LINEUP = ['shorthair', 'persian', 'siamese', 'orange-tabby', 'black', 'calico'];
const COUNT = 8;
const STAGE_H = 0.45;
const STAGE_R = 2.3;

/**
 * M3 cat showcase: a raised round stage in the middle of the shop with roaming cats so the
 * looks and animations can be judged on a phone. Villas replace it in M6.
 */
export class CatShowcase {
  readonly cats: CatEntity[] = [];
  private readonly interactables: Interactable[] = [];
  private readonly group = new THREE.Group();
  private forced: CatActivityId | null = null;
  readonly area: RoamArea = { center: new THREE.Vector3(0, STAGE_H, -1.4), radius: STAGE_R - 0.55 };

  constructor(
    scene: THREE.Scene,
    private readonly interactions: InteractionSystem,
    colliders: CollisionWorld,
  ) {
    // Round cushioned stage so cats sit nearer eye level (like villas will).
    const { x, z } = this.area.center;
    const base = mesh(cachedGeometry('stage-base', () => new THREE.CylinderGeometry(STAGE_R, STAGE_R + 0.06, STAGE_H - 0.08, 56)), pastel('#f6e3cf', 0.8));
    base.position.set(x, (STAGE_H - 0.08) / 2, z);
    const cushion = mesh(cachedGeometry('stage-top', () => new THREE.CylinderGeometry(STAGE_R - 0.05, STAGE_R - 0.02, 0.08, 56)), pastel('#ffe1e6', 0.95));
    cushion.position.set(x, STAGE_H - 0.04, z);
    const ring = mesh(cachedGeometry('stage-ring', () => new THREE.TorusGeometry(STAGE_R - 0.03, 0.05, 10, 72).rotateX(Math.PI / 2)), pastel('#ffc2cf', 0.7));
    ring.position.set(x, STAGE_H - 0.01, z);
    this.group.add(base, cushion, ring);
    colliders.addCentered(x, z, STAGE_R * 1.8, STAGE_R * 1.8);
    scene.add(this.group);
    this.spawn();
  }

  /** Replace all cats with a fresh random set. */
  reroll(): void {
    for (const c of this.cats) c.group.removeFromParent();
    for (const i of this.interactables) this.interactions.remove(i);
    this.cats.length = 0;
    this.interactables.length = 0;
    this.spawn();
    if (this.forced) this.forceAll(this.forced);
  }

  forceAll(activity: CatActivityId | null): void {
    this.forced = activity;
    for (const c of this.cats) c.force(activity);
  }

  meowAll(): void {
    this.cats.forEach((c, i) => setTimeout(() => c.meow(), i * 120));
  }

  catFor(item: Interactable | null): CatEntity | null {
    if (!item) return null;
    const i = this.interactables.indexOf(item);
    return i >= 0 ? this.cats[i] : null;
  }

  update(dt: number): void {
    for (const c of this.cats) c.update(dt);
  }

  private spawn(): void {
    for (let i = 0; i < COUNT; i++) {
      const data = generateCat({ breedId: LINEUP[i] });
      const a = (i / COUNT) * Math.PI * 2;
      const r = this.area.radius * 0.7;
      const start = new THREE.Vector3(this.area.center.x + Math.cos(a) * r, STAGE_H, this.area.center.z + Math.sin(a) * r);
      const cat = new CatEntity(data, this.area, start);
      this.group.add(cat.group);
      this.cats.push(cat);
      const item: Interactable = {
        position: cat.position,
        object: cat.hitProxy,
        highlight: cat.model.mesh,
        label: () => 'Play',
        act: () => {
          cat.play();
          haptic([12, 40, 12]);
        },
      };
      this.interactions.add(item);
      this.interactables.push(item);
    }
  }
}
