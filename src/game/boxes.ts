import * as THREE from 'three';
import { PRODUCT_BY_ID, type ProductDef } from '../config/products';
import { haptic } from '../core/haptics';
import { blobShadow } from '../models/blob-shadow';
import { CartonView } from '../models/carton-model';
import { CARTON_SIZE } from '../models/product-factory';
import type { CollisionWorld } from '../world/colliders';
import { STORE } from '../world/layout';
import { DELIVERY_PAD } from '../world/shelf-layout';
import { REACH, type InfoCardData, type Interactable, type InteractionSystem } from './interactions';
import type { Player } from './player';

const [BW, BH, BD] = CARTON_SIZE;
const MAX_LEVEL = 2;

export interface Box {
  id: number;
  productId: string;
  count: number;
  group: THREE.Group;
  /** 0 = on the floor, 1+ = stacked. */
  level: number;
  colliderId: number | null;
  shadow: THREE.Mesh;
  view: CartonView;
}

/** Delivery cartons: spawn on the pad, carry, place, stack, stock shelves. */
export class BoxManager {
  readonly boxes: Box[] = [];
  private nextId = 1;
  private readonly spot = new THREE.Vector3();
  private spotValid = false;
  private spotLevel = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly player: Player,
    private readonly interactions: InteractionSystem,
    private readonly colliders: CollisionWorld,
    private readonly onChange: () => void = () => {},
  ) {
    // Ambient "Place" action: puts the carried box where the crosshair meets the floor.
    interactions.add({
      position: this.spot,
      label: () => {
        const box = this.carried;
        if (!box) return null;
        this.computeSpot();
        return this.spotValid ? 'Place' : null;
      },
      act: () => this.placeCarried(),
      info: () => (this.carried ? this.infoFor(this.carried) : null),
    });
  }

  get carried(): Box | null {
    return (this.player.carried?.userData.box as Box | undefined) ?? null;
  }

  /** Floor spot preview for the target ring (null when not carrying). */
  placeSpot(): THREE.Vector3 | null {
    return this.carried && this.spotValid ? this.spot : null;
  }

  infoFor(box: Box): InfoCardData {
    const def = PRODUCT_BY_ID[box.productId];
    return { key: `box:${box.id}:${box.count}`, title: def.name, sub: `Box · ${box.count} item${box.count === 1 ? '' : 's'}`, tag: def.sub };
  }

  /** Creates a box on the floor; interactions are registered here. */
  private create(def: ProductDef, count: number): Box {
    const view = new CartonView(def, count);
    const group = view.group;
    group.userData.outline = 0.012;
    const box: Box = {
      id: this.nextId++,
      productId: def.id,
      count,
      group,
      level: 0,
      colliderId: null,
      shadow: blobShadow(0.8, 0.7, 0.9),
      view,
    };
    group.userData.box = box;
    this.boxes.push(box);
    this.interactions.add(this.interactableFor(box));
    return box;
  }

  private readonly itemInteractions = new Map<Box, Interactable>();

  private interactableFor(box: Box): Interactable {
    const item: Interactable = {
      position: box.group.position,
      object: box.group,
      label: () => (this.player.carried || this.hasBoxAbove(box) ? null : 'Pick up'),
      act: () => this.carry(box),
      info: () => this.infoFor(box),
    };
    this.itemInteractions.set(box, item);
    return item;
  }

  private hasBoxAbove(box: Box): boolean {
    return this.boxes.some((b) => b !== box && b.level === box.level + 1 && this.sameCell(b, box) && b.group.parent === this.scene);
  }

  private sameCell(a: Box, b: Box): boolean {
    return Math.abs(a.group.position.x - b.group.position.x) < 0.2 && Math.abs(a.group.position.z - b.group.position.z) < 0.2;
  }

  /** Puts a box on the floor / stack at a world position. */
  private setDown(box: Box, x: number, z: number, level: number, yaw: number): void {
    box.level = level;
    box.group.position.set(x, level * BH, z);
    box.group.rotation.set(0, yaw, 0);
    this.scene.add(box.group);
    box.shadow.position.set(x, 0.012, z);
    box.shadow.rotation.y = yaw;
    if (level === 0) {
      this.scene.add(box.shadow);
      box.colliderId = this.colliders.addCentered(x, z, BW * 0.9, BD * 0.9);
    } else {
      box.shadow.removeFromParent();
    }
  }

  private liftUp(box: Box): void {
    if (box.colliderId !== null) this.colliders.remove(box.colliderId);
    box.colliderId = null;
    box.shadow.removeFromParent();
  }

  /** Boxes of the given products appear on the delivery pad. */
  spawnDelivery(lines: Record<string, number>): void {
    const items: Array<{ productId: string; count: number }> = [];
    for (const [productId, n] of Object.entries(lines)) {
      for (let i = 0; i < n; i++) items.push({ productId, count: PRODUCT_BY_ID[productId].boxSize });
    }
    this.spawnBoxes(items);
  }

  /** What the player owns as loose stock (floor and hands), for saving. */
  serialize(): Array<{ productId: string; count: number }> {
    return this.boxes.filter((b) => b.count > 0).map((b) => ({ productId: b.productId, count: b.count }));
  }

  /** Boxes with exact counts appear on the delivery pad (also used when loading a save). */
  spawnBoxes(items: Array<{ productId: string; count: number }>): void {
    const cols = Math.floor(DELIVERY_PAD.w / (BW + 0.06));
    const rows = Math.floor(DELIVERY_PAD.d / (BD + 0.06));
    const cells: Array<[number, number, number]> = [];
    for (let level = 0; level <= MAX_LEVEL; level++) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = DELIVERY_PAD.x - DELIVERY_PAD.w / 2 + (c + 0.5) * (DELIVERY_PAD.w / cols);
          const z = DELIVERY_PAD.z - DELIVERY_PAD.d / 2 + (r + 0.5) * (DELIVERY_PAD.d / rows);
          cells.push([x, z, level]);
        }
      }
    }
    for (const { productId, count } of items) {
      const def = PRODUCT_BY_ID[productId];
      if (!def || count <= 0) continue;
      const cell = cells.find(([x, z, level]) => !this.boxes.some((b) => b.group.parent === this.scene && b.level === level && Math.abs(b.group.position.x - x) < 0.15 && Math.abs(b.group.position.z - z) < 0.15));
      if (!cell) continue; // pad is full; extra boxes are dropped (rare)
      const box = this.create(def, count);
      this.setDown(box, cell[0], cell[1], cell[2], 0);
    }
    this.onChange();
  }

  /** Box appears directly in the player's hands (e.g. taken from a shelf). */
  createCarried(productId: string, count: number): void {
    const box = this.create(PRODUCT_BY_ID[productId], count);
    this.player.pickUp(box.group);
    box.group.position.y = -BH / 2;
    box.view.unbox();
    this.onChange();
  }

  private carry(box: Box): void {
    this.liftUp(box);
    this.player.pickUp(box.group);
    box.group.position.y = -BH / 2;
    box.level = 0;
    box.view.unbox(); // opens itself: flaps swing out, items pop up
    haptic([14, 30, 10]);
  }

  /** Removes `n` items from a carried box; the empty box shrinks away. */
  consume(box: Box, n: number): void {
    box.count = Math.max(0, box.count - n);
    box.view.setCount(box.count);
    if (box.count === 0) this.vanish(box);
  }

  private readonly vanishing: Array<{ box: Box; t: number }> = [];

  /** Empty box: hands let go and it pops away. */
  private vanish(box: Box): void {
    if (this.player.carried === box.group) this.player.carried = null;
    const i = this.boxes.indexOf(box);
    if (i >= 0) this.boxes.splice(i, 1);
    const item = this.itemInteractions.get(box);
    if (item) this.interactions.remove(item);
    this.itemInteractions.delete(box);
    this.vanishing.push({ box, t: 0 });
    this.onChange();
  }

  /** Per-frame: unbox animations and vanishing boxes. */
  update(dt: number): void {
    for (const b of this.boxes) b.view.update(dt);
    for (let i = this.vanishing.length - 1; i >= 0; i--) {
      const v = this.vanishing[i];
      v.t += dt / 0.28;
      v.box.view.update(dt);
      const k = Math.max(0, 1 - v.t);
      // quick squash-and-pop out
      v.box.group.scale.set(k * (1 + (1 - k) * 0.3), k * k, k * (1 + (1 - k) * 0.3));
      if (v.t >= 1) {
        v.box.group.removeFromParent();
        v.box.group.scale.set(1, 1, 1);
        this.vanishing.splice(i, 1);
      }
    }
  }

  /** World-space point where items leave the hands (below / ahead of the camera). */
  handsOrigin(out: THREE.Vector3): THREE.Vector3 {
    const cam = this.player.view.camera;
    return out.set(0, -0.3, -0.6).applyMatrix4(cam.matrixWorld);
  }

  discard(box: Box): void {
    if (this.player.carried === box.group) this.player.drop();
    box.group.removeFromParent();
    this.liftUp(box);
    const i = this.boxes.indexOf(box);
    if (i >= 0) this.boxes.splice(i, 1);
    const item = this.itemInteractions.get(box);
    if (item) this.interactions.remove(item);
    this.itemInteractions.delete(box);
    this.onChange();
  }

  /** Computes where the carried box would land (floor or on top of another box). */
  private computeSpot(): void {
    const p = this.player.view.floorPoint(REACH);
    const half = Math.max(BW, BD) / 2;
    const m = 0.1;
    p.x = THREE.MathUtils.clamp(p.x, STORE.minX + half + m + 0.33, STORE.maxX - half - m);
    p.z = THREE.MathUtils.clamp(p.z, STORE.minZ + half + m, STORE.maxZ - half - m);
    const dx = p.x - this.player.position.x;
    const dz = p.z - this.player.position.z;
    const d = Math.hypot(dx, dz);
    const minD = 0.8;
    if (d < minD) {
      const ux = d > 1e-3 ? dx / d : -Math.sin(this.player.yaw);
      const uz = d > 1e-3 ? dz / d : -Math.cos(this.player.yaw);
      p.x = this.player.position.x + ux * minD;
      p.z = this.player.position.z + uz * minD;
    }
    // Stack on a nearby box instead of overlapping it.
    let level = 0;
    for (const b of this.boxes) {
      if (b.group.parent !== this.scene) continue;
      if (Math.abs(b.group.position.x - p.x) < BW * 0.8 && Math.abs(b.group.position.z - p.z) < BD * 0.8) {
        level = Math.max(level, b.level + 1);
        p.x = b.group.position.x;
        p.z = b.group.position.z;
      }
    }
    this.spotLevel = level;
    this.spot.copy(p);
    this.spotValid = level <= MAX_LEVEL && (level > 0 || !this.colliders.overlapsBox(p.x, p.z, BW * 0.45, BD * 0.45));
  }

  private placeCarried(): void {
    const box = this.carried;
    if (!box) return;
    this.computeSpot();
    if (!this.spotValid) return;
    this.player.drop();
    this.setDown(box, this.spot.x, this.spot.z, this.spotLevel, this.player.yaw);
    haptic(12);
  }
}
