import * as THREE from 'three';
import { CATEGORIES, PRODUCT_BY_ID, type ProductDef } from '../config/products';
import { ITEM_GAP, SHELF_TYPES, SLOT_MAX_ITEMS, type ShelfTypeDef } from '../config/shelves';
import { cachedGeometry, cachedMaterial } from '../core/cache';
import { haptic } from '../core/haptics';
import { mergeStatic } from '../core/merge-static';
import { buildShelfGeometry, type SlotFrame } from '../models/shelf-model';
import { getProductModel } from '../models/product-factory';
import type { CollisionWorld } from '../world/colliders';
import { SHELF_SPOTS, type ShelfSpot } from '../world/shelf-layout';
import type { Box, BoxManager } from './boxes';
import { PriceTagLayer } from './price-tags';
import { NO_OUTLINE, type InfoCardData, type Interactable, type InteractionSystem } from './interactions';

const MAX_INSTANCES = 700;
const TMP = new THREE.Matrix4();
const LOCAL = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const V = new THREE.Vector3();
const S = new THREE.Vector3();

/** Tap places one item; holding past this delay auto-fills one by one until released. */
const HOLD_DELAY = 0.32;
const FLIGHT_SECONDS = 0.24;
const START_INTERVAL = 0.16;
const MIN_INTERVAL = 0.055;

export interface SlotGrid {
  cols: number;
  rows: number;
  layers: number;
  capacity: number;
}

/** How many items of `def` fit in one slot of `type` (0 = too tall). */
export function slotGrid(def: ProductDef, type: ShelfTypeDef): SlotGrid {
  const [w, h, d] = def.size;
  let layers = Math.min(def.layers, Math.floor((type.clearHeight + 0.001) / h));
  if (layers < 1) return { cols: 0, rows: 0, layers: 0, capacity: 0 };
  layers = Math.max(1, layers);
  const cols = Math.max(1, Math.floor((type.slotW - 0.03) / (w + ITEM_GAP)));
  const rows = Math.max(1, Math.floor((type.slotD - 0.02) / (d + ITEM_GAP)));
  return { cols, rows, layers, capacity: Math.min(cols * rows * layers, SLOT_MAX_ITEMS) };
}

export class ShelfSlot {
  productId: string | null = null;
  /** Items that have landed on the shelf. */
  count = 0;
  /** Items currently flying toward this slot. */
  inflight = 0;
  /** Index of the item playing its landing squash (-1 = none). */
  popIndex = -1;
  popT = 1;
  readonly proxy: THREE.Mesh;

  constructor(
    readonly unit: ShelfUnit,
    readonly frame: SlotFrame,
    readonly id: string,
  ) {
    const t = unit.type;
    this.proxy = new THREE.Mesh(
      cachedGeometry(`slot-proxy:${t.id}`, () => new THREE.BoxGeometry(t.slotW - 0.02, t.clearHeight, t.slotD)),
      cachedMaterial('slot-proxy', () => new THREE.MeshBasicMaterial({ visible: false })),
    );
    this.proxy.userData.dynamic = true;
    const local = new THREE.Vector3(frame.center.x, frame.center.y + t.clearHeight / 2, frame.center.z);
    this.proxy.position.copy(local).applyAxisAngle(new THREE.Vector3(0, 1, 0), unit.spot.yaw).add(new THREE.Vector3(unit.spot.x, 0, unit.spot.z));
    this.proxy.rotation.y = unit.spot.yaw;
    this.proxy.updateMatrixWorld(true);
  }

  get def(): ProductDef | null {
    return this.productId ? PRODUCT_BY_ID[this.productId] : null;
  }

  capacityFor(def: ProductDef): number {
    return slotGrid(def, this.unit.type).capacity;
  }

  /** Items on the shelf plus those still in the air. */
  get committed(): number {
    return this.count + this.inflight;
  }

  worldSurface(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.frame.center.x, this.frame.center.y, this.frame.center.z).applyMatrix4(this.unit.matrix);
  }

  /** Unit-local position of item `i` (bottom centre). */
  itemLocal(def: ProductDef, i: number, out: THREE.Vector3): THREE.Vector3 {
    const grid = slotGrid(def, this.unit.type);
    const [w, h, d] = def.size;
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols) % grid.rows;
    const layer = Math.floor(i / (grid.cols * grid.rows));
    return out.set(
      this.frame.center.x + (col - (grid.cols - 1) / 2) * (w + ITEM_GAP),
      this.frame.center.y + layer * h,
      this.frame.frontZ - 0.012 - d / 2 - row * (d + ITEM_GAP),
    );
  }
}

export class ShelfUnit {
  readonly type: ShelfTypeDef;
  readonly matrix = new THREE.Matrix4();
  readonly slots: ShelfSlot[] = [];
  readonly width: number;
  readonly depth: number;
  readonly staticGroup: THREE.Group;

  constructor(readonly spot: ShelfSpot) {
    this.type = SHELF_TYPES[spot.type];
    const geo = buildShelfGeometry(this.type);
    this.width = geo.width;
    this.depth = geo.depth;
    this.staticGroup = geo.group;
    this.staticGroup.position.set(spot.x, 0, spot.z);
    this.staticGroup.rotation.y = spot.yaw;
    this.staticGroup.updateMatrixWorld(true);
    this.matrix.copy(this.staticGroup.matrixWorld);
    geo.slots.forEach((f, i) => this.slots.push(new ShelfSlot(this, f, `${spot.id}:${i}`)));
  }
}

/** Mint highlight lying on the targeted slot's board; pulses on each landing. */
class SlotMarker {
  readonly mesh: THREE.Mesh;
  private time = 0;
  private bumpT = 0;
  private baseScale = new THREE.Vector3(1, 1, 1);

  constructor() {
    this.mesh = new THREE.Mesh(
      cachedGeometry('slot-marker', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
      new THREE.MeshBasicMaterial({ color: '#5fe0c0', transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  show(slot: ShelfSlot): void {
    const t = slot.unit.type;
    slot.worldSurface(this.mesh.position);
    this.mesh.position.y += 0.004;
    this.mesh.rotation.y = slot.unit.spot.yaw;
    this.baseScale.set(t.slotW - 0.03, 1, t.slotD - 0.02);
    this.mesh.scale.copy(this.baseScale);
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  bump(): void {
    this.bumpT = 1;
  }

  update(dt: number): void {
    this.time += dt;
    this.bumpT = Math.max(0, this.bumpT - dt * 5);
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(this.time * 6) * 0.1 + this.bumpT * 0.35;
    const k = 1 + this.bumpT * 0.06;
    this.mesh.scale.set(this.baseScale.x * k, 1, this.baseScale.z * k);
  }
}

interface Flight {
  mesh: THREE.Mesh;
  def: ProductDef;
  slot: ShelfSlot;
  index: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  spin: number;
}

interface Session {
  slot: ShelfSlot;
  box: Box;
  timer: number;
  streak: number;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * All shelf units: static frames (merged), per-product instanced items,
 * and satisfying stocking: tap = place one, hold = auto-fill one by one.
 */
export class ShelfManager {
  readonly units: ShelfUnit[] = [];
  /** Parent for instanced item meshes and flying items. */
  readonly itemsRoot = new THREE.Group();
  private readonly instanced = new Map<string, THREE.InstancedMesh>();
  private readonly marker = new SlotMarker();
  private readonly tags = new PriceTagLayer();
  private readonly flights: Flight[] = [];
  private readonly pool = new Map<string, THREE.Mesh[]>();
  private session: Session | null = null;
  private dirty = true;

  constructor(
    scene: THREE.Scene,
    colliders: CollisionWorld,
    private readonly interactions: InteractionSystem,
    private readonly boxes: BoxManager,
    private readonly onLaunch: () => void = () => {},
  ) {
    const frames = new THREE.Group();
    const proxies = new THREE.Group();
    for (const spot of SHELF_SPOTS) {
      const unit = new ShelfUnit(spot);
      this.units.push(unit);
      frames.add(unit.staticGroup);
      for (const slot of unit.slots) {
        proxies.add(slot.proxy);
        this.registerSlot(slot);
      }
      const alongX = Math.abs(Math.sin(spot.yaw)) < 0.5;
      colliders.addCentered(spot.x, spot.z, alongX ? unit.width : unit.depth, alongX ? unit.depth : unit.width);
    }
    // Collapse the static frames into a handful of draw calls.
    frames.add(mergeStatic(frames));
    scene.add(frames, proxies, this.itemsRoot, this.tags.root, this.marker.mesh);
  }

  /** Call once per frame. */
  update(dt: number): void {
    this.marker.update(dt);
    this.updateSession(dt);
    this.updateFlights(dt);
    for (const unit of this.units) {
      for (const slot of unit.slots) {
        if (slot.popIndex >= 0) {
          slot.popT += dt / 0.4;
          if (slot.popT >= 1) slot.popIndex = -1;
          this.dirty = true;
        }
      }
    }
    if (this.dirty) this.rebuildInstances();
  }

  /** Total items on shelves for a product (used by customers in M5). */
  stockOf(productId: string): number {
    let n = 0;
    for (const u of this.units) for (const s of u.slots) if (s.productId === productId) n += s.count;
    return n;
  }

  // ---------------------------------------------------------------- interaction

  private registerSlot(slot: ShelfSlot): void {
    const item: Interactable = {
      position: slot.proxy.position,
      object: slot.proxy,
      highlight: NO_OUTLINE,
      label: () => this.labelFor(slot),
      act: () => undefined,
      onPress: () => this.press(slot),
      onRelease: () => this.release(slot),
      onCancel: () => this.endSession(false),
      info: () => this.infoFor(slot),
      onFocus: () => this.marker.show(slot),
      onBlur: () => this.marker.hide(),
    };
    this.interactions.add(item);
  }

  private canStock(slot: ShelfSlot): boolean {
    const box = this.boxes.carried;
    if (!box) return false;
    const def = PRODUCT_BY_ID[box.productId];
    if (slot.productId !== null && slot.productId !== def.id) return false;
    const cap = slot.capacityFor(def);
    return cap > 0 && slot.committed < cap && box.count > 0;
  }

  private labelFor(slot: ShelfSlot): string | null {
    if (this.session?.slot === slot) return 'Stocking…';
    if (this.boxes.carried) return this.canStock(slot) ? 'Stock shelf' : null;
    return slot.count > 0 ? 'Take items' : null;
  }

  private press(slot: ShelfSlot): void {
    const box = this.boxes.carried;
    if (box) {
      if (!this.canStock(slot)) return;
      this.session = { slot, box, timer: HOLD_DELAY, streak: 0 };
      this.launch(this.session); // first item leaves instantly so it feels responsive
      return;
    }
    if (slot.count > 0 && slot.def) {
      const id = slot.def.id;
      const n = Math.min(slot.count, slot.def.boxSize);
      slot.count -= n;
      if (slot.committed === 0) slot.productId = null;
      this.dirty = true;
      haptic(14);
      this.boxes.createCarried(id, n);
    }
  }

  private release(slot: ShelfSlot): void {
    if (this.session?.slot === slot) this.endSession(false);
  }

  private endSession(done: boolean): void {
    const s = this.session;
    this.session = null;
    if (done && s) {
      this.marker.bump();
      haptic([10, 40, 14]);
    }
  }

  private updateSession(dt: number): void {
    const s = this.session;
    if (!s) return;
    s.timer -= dt;
    while (s.timer <= 0) {
      const stillCarrying = this.boxes.carried === s.box && s.box.count > 0;
      const room = s.slot.committed < s.slot.capacityFor(PRODUCT_BY_ID[s.box.productId]);
      if (!stillCarrying || !room) {
        this.endSession(true);
        return;
      }
      this.launch(s);
      // Accelerating rhythm: each item comes a little faster than the last.
      s.timer += Math.max(MIN_INTERVAL, START_INTERVAL - s.streak * 0.012);
    }
  }

  // -------------------------------------------------------------------- flights

  /** Sends one item from the carried box to the next free spot in the slot. */
  private launch(s: Session): void {
    const def = PRODUCT_BY_ID[s.box.productId];
    const slot = s.slot;
    slot.productId = def.id;
    const index = slot.committed;
    slot.inflight++;
    s.streak++;
    this.dirty = true;

    const mesh = this.takeFlyer(def);
    const from = this.boxes.handsOrigin(new THREE.Vector3());
    const to = slot.itemLocal(def, index, new THREE.Vector3()).applyMatrix4(slot.unit.matrix);
    mesh.position.copy(from);
    mesh.scale.setScalar(0.75);
    mesh.visible = true;
    this.itemsRoot.add(mesh);
    this.flights.push({ mesh, def, slot, index, from, to, t: 0, spin: (Math.random() - 0.5) * 3 });

    this.boxes.consume(s.box, 1);
    this.onLaunch();
    haptic(6);
  }

  private updateFlights(dt: number): void {
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t = Math.min(1, f.t + dt / FLIGHT_SECONDS);
      const e = easeOutCubic(f.t);
      f.mesh.position.lerpVectors(f.from, f.to, e);
      f.mesh.position.y += Math.sin(Math.PI * f.t) * 0.16;
      f.mesh.scale.setScalar(0.75 + 0.25 * e);
      f.mesh.rotation.y = f.slot.unit.spot.yaw + f.spin * (1 - e);
      f.mesh.rotation.z = (1 - e) * f.spin * 0.4;
      if (f.t >= 1) {
        this.land(f);
        this.flights.splice(i, 1);
      }
    }
  }

  private land(f: Flight): void {
    f.mesh.visible = false;
    f.mesh.removeFromParent();
    this.pool.get(f.def.id)?.push(f.mesh);
    f.slot.inflight = Math.max(0, f.slot.inflight - 1);
    f.slot.count++;
    f.slot.popIndex = f.index;
    f.slot.popT = 0;
    this.dirty = true;
    this.marker.bump();
    haptic(7);
  }

  private takeFlyer(def: ProductDef): THREE.Mesh {
    const list = this.pool.get(def.id) ?? [];
    this.pool.set(def.id, list);
    const m = list.pop();
    if (m) return m;
    const model = getProductModel(def);
    const mesh = new THREE.Mesh(model.geometry, model.material);
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    return mesh;
  }

  // ------------------------------------------------------------------- display

  private infoFor(slot: ShelfSlot): InfoCardData | null {
    const box = this.boxes.carried;
    const def = slot.def;
    if (def) {
      const cap = slot.capacityFor(def);
      const cat = CATEGORIES.find((c) => c.id === def.category);
      const wrong = box !== null && box.productId !== def.id;
      return {
        key: `slot:${slot.id}:${slot.count}:${box?.productId ?? ''}`,
        title: def.name,
        sub: wrong ? `This spot is reserved for ${def.name}` : `$${def.price.toFixed(2)} · ${slot.count} / ${cap} on shelf`,
        tag: wrong ? 'Pick another spot' : cat ? `${cat.icon} ${cat.label}` : def.sub,
      };
    }
    if (box) {
      const bdef = PRODUCT_BY_ID[box.productId];
      const fits = slot.capacityFor(bdef) > 0;
      return { key: `slot:${slot.id}:empty:${box.productId}`, title: 'Empty slot', sub: fits ? `Holds up to ${slot.capacityFor(bdef)} ${bdef.name}` : `${bdef.name} is too tall here`, tag: fits ? 'Tap = 1, hold = fill' : 'Try a Low Bench' };
    }
    return null;
  }

  private rebuildInstances(): void {
    this.dirty = false;
    this.tags.rebuild(this.units);
    const counts = new Map<string, number>();
    for (const unit of this.units) {
      for (const slot of unit.slots) {
        const def = slot.def;
        if (!def || slot.count === 0) continue;
        const mesh = this.meshFor(def);
        let idx = counts.get(def.id) ?? 0;
        for (let i = 0; i < slot.count && idx < MAX_INSTANCES; i++, idx++) {
          slot.itemLocal(def, i, V);
          // Landing squash: a quick damped spring on the newest item.
          let sy = 1;
          let sxz = 1;
          if (i === slot.popIndex && slot.popT < 1) {
            const damp = Math.exp(-7 * slot.popT) * Math.cos(18 * slot.popT);
            sy = 1 - 0.28 * damp;
            sxz = 1 + 0.12 * damp;
          }
          LOCAL.compose(V, Q.identity(), S.set(sxz, sy, sxz));
          TMP.multiplyMatrices(unit.matrix, LOCAL);
          mesh.setMatrixAt(idx, TMP);
        }
        counts.set(def.id, idx);
      }
    }
    for (const [id, mesh] of this.instanced) {
      const n = counts.get(id) ?? 0;
      mesh.count = n;
      mesh.visible = n > 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private meshFor(def: ProductDef): THREE.InstancedMesh {
    let mesh = this.instanced.get(def.id);
    if (!mesh) {
      const model = getProductModel(def);
      mesh = new THREE.InstancedMesh(model.geometry, model.material, MAX_INSTANCES);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      this.instanced.set(def.id, mesh);
      this.itemsRoot.add(mesh);
    }
    return mesh;
  }
}
