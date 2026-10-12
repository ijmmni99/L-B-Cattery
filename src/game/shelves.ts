import * as THREE from 'three';
import { CATEGORIES, PRODUCT_BY_ID, type ProductDef } from '../config/products';
import { ITEM_GAP, SHELF_TYPES, SLOT_MAX_ITEMS, type ShelfTypeDef } from '../config/shelves';
import { cachedGeometry, cachedMaterial } from '../core/cache';
import { haptic } from '../core/haptics';
import { mergeStatic } from '../core/merge-static';
import { buildShelfGeometry, type SlotFrame } from '../models/shelf-model';
import { getProductModel } from '../models/product-factory';
import type { CollisionWorld } from '../world/colliders';
import type { ShelfSpot } from '../world/shelf-layout';
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
  /** Identity wrapper that holds the merged static frame. */
  readonly root = new THREE.Group();
  readonly items: Interactable[] = [];
  readonly pickBox: THREE.Mesh;
  colliderId = -1;
  removed = false;

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
    this.pickBox = new THREE.Mesh(new THREE.BoxGeometry(geo.width, geo.height, geo.depth), new THREE.MeshBasicMaterial({ visible: false }));
    this.pickBox.position.set(spot.x, geo.height / 2, spot.z);
    this.pickBox.rotation.y = spot.yaw;
    this.pickBox.updateMatrixWorld(true);
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
    this.colliders = colliders;
    scene.add(this.frames, this.proxies, this.itemsRoot, this.tags.root, this.marker.mesh, this.pickables);
  }

  private readonly frames = new THREE.Group();
  private readonly proxies = new THREE.Group();
  private readonly colliders: CollisionWorld;

  /** Invisible boxes build mode raycasts to select a unit. */
  readonly pickables = new THREE.Group();

  /** Builds a shelf unit at a spot (start-up, buying, moving, or loading a save). */
  addUnit(spot: ShelfSpot): ShelfUnit {
    const unit = new ShelfUnit(spot);
    this.units.push(unit);
    unit.root.add(unit.staticGroup);
    // Collapse the static frame into a few draw calls.
    unit.root.updateMatrixWorld(true);
    unit.root.add(mergeStatic(unit.root));
    this.frames.add(unit.root);
    for (const slot of unit.slots) {
      this.proxies.add(slot.proxy);
      unit.items.push(this.registerSlot(slot));
    }
    const alongX = Math.abs(Math.sin(spot.yaw)) < 0.5;
    unit.colliderId = this.colliders.addCentered(spot.x, spot.z, alongX ? unit.width : unit.depth, alongX ? unit.depth : unit.width);
    unit.pickBox.userData.placed = { kind: 'shelf', unit };
    this.pickables.add(unit.pickBox);
    this.dirty = true;
    return unit;
  }

  /**
   * Takes a unit out of the shop. Returns what was on it so the caller can hand it
   * back as boxes (nothing is lost).
   */
  removeUnit(unit: ShelfUnit): Array<{ productId: string; count: number }> {
    unit.removed = true;
    if (this.session?.slot.unit === unit) this.session = null;
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      if (f.slot.unit !== unit) continue;
      f.mesh.visible = false;
      f.mesh.removeFromParent();
      this.pool.get(f.def.id)?.push(f.mesh);
      this.flights.splice(i, 1);
    }
    const contents: Array<{ productId: string; count: number }> = [];
    for (const slot of unit.slots) {
      const n = slot.count + slot.inflight;
      if (slot.productId && n > 0) contents.push({ productId: slot.productId, count: n });
      this.proxies.remove(slot.proxy);
    }
    for (const it of unit.items) this.interactions.remove(it);
    this.colliders.remove(unit.colliderId);
    unit.root.removeFromParent();
    unit.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.merged) o.geometry.dispose();
    });
    unit.pickBox.removeFromParent();
    this.units.splice(this.units.indexOf(unit), 1);
    this.marker.hide();
    this.dirty = true;
    return contents;
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

  /** Slots that currently have sellable items on the shelf. */
  stockedSlots(): ShelfSlot[] {
    const out: ShelfSlot[] = [];
    for (const u of this.units) for (const s of u.slots) if (s.def && s.count > 0) out.push(s);
    return out;
  }

  /** True if any shelf holds cat food. */
  hasFood(): boolean {
    return this.units.some((u) => u.slots.some((s) => s.count > 0 && s.def?.category === 'food'));
  }

  /** Takes one unit of cat food from the shelves (the cheapest first); null if none. */
  takeFood(): string | null {
    let best: ShelfSlot | null = null;
    for (const u of this.units) for (const s of u.slots) if (s.count > 0 && s.def?.category === 'food' && (!best || s.def.price < (best.def?.price ?? 99))) best = s;
    if (!best) return null;
    this.sell(best, 1);
    return best.def?.id ?? null;
  }

  /** Floor spot in front of a slot where a customer stands to browse it. */
  standPoint(slot: ShelfSlot, out: THREE.Vector3): THREE.Vector3 {
    const yaw = slot.unit.spot.yaw;
    return out.set(slot.proxy.position.x + Math.sin(yaw) * 0.85, 0, slot.proxy.position.z + Math.cos(yaw) * 0.85);
  }

  /** Customer buys up to `qty` items from a slot; returns how many were taken. */
  sell(slot: ShelfSlot, qty: number): number {
    const n = Math.min(qty, slot.count);
    if (n <= 0) return 0;
    slot.count -= n;
    // The slot keeps its product reservation so the player can simply restock it.
    this.dirty = true;
    return n;
  }

  /** Rebuild price tags / instances (e.g. after a price change). */
  markDirty(): void {
    this.dirty = true;
  }

  /** The shelf layout, for saving. */
  layout(): ShelfSpot[] {
    return this.units.map((u) => ({ ...u.spot }));
  }

  serialize(): Array<{ id: string; productId: string; count: number }> {
    const out: Array<{ id: string; productId: string; count: number }> = [];
    for (const u of this.units) for (const s of u.slots) if (s.productId) out.push({ id: s.id, productId: s.productId, count: s.count });
    return out;
  }

  restore(saved: Array<{ id: string; productId: string; count: number }>): void {
    for (const s of saved) {
      const def = PRODUCT_BY_ID[s.productId];
      if (!def) continue;
      for (const u of this.units) {
        const slot = u.slots.find((x) => x.id === s.id);
        if (!slot) continue;
        slot.productId = def.id;
        slot.count = Math.max(0, Math.min(s.count, slot.capacityFor(def)));
      }
    }
    this.dirty = true;
  }

  // ---------------------------------------------------------------- interaction

  private registerSlot(slot: ShelfSlot): Interactable {
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
    return item;
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
