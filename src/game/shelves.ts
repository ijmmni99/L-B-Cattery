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
import type { BoxManager } from './boxes';
import { NO_OUTLINE, type InfoCardData, type Interactable, type InteractionSystem } from './interactions';

const MAX_INSTANCES = 700;
const TMP = new THREE.Matrix4();
const LOCAL = new THREE.Matrix4();

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
  count = 0;
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
    // Place in world space: unit transform applied to the slot centre.
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

  /** World position of the slot's board surface centre. */
  worldSurface(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.frame.center.x, this.frame.center.y, this.frame.center.z).applyMatrix4(this.unit.matrix);
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

/** Mint highlight lying on the targeted slot's board. */
class SlotMarker {
  readonly mesh: THREE.Mesh;
  private time = 0;

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
    this.mesh.scale.set(t.slotW - 0.03, 1, t.slotD - 0.02);
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  update(dt: number): void {
    this.time += dt;
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(this.time * 6) * 0.12;
  }
}

/**
 * All shelf units: static frames (merged), per-product instanced items,
 * slot interactions (stock from the carried box / take items back).
 */
export class ShelfManager {
  readonly units: ShelfUnit[] = [];
  private readonly instanced = new Map<string, THREE.InstancedMesh>();
  private readonly marker = new SlotMarker();
  private dirty = true;

  constructor(
    scene: THREE.Scene,
    colliders: CollisionWorld,
    private readonly interactions: InteractionSystem,
    private readonly boxes: BoxManager,
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
    scene.add(frames, proxies, this.itemsRoot, this.marker.mesh);
  }

  /** Call once per frame. */
  update(dt: number): void {
    this.marker.update(dt);
    if (this.dirty) this.rebuildInstances();
  }

  /** Total items on shelves for a product (used by customers in M5). */
  stockOf(productId: string): number {
    let n = 0;
    for (const u of this.units) for (const s of u.slots) if (s.productId === productId) n += s.count;
    return n;
  }

  private registerSlot(slot: ShelfSlot): void {
    const item: Interactable = {
      position: slot.proxy.position,
      object: slot.proxy,
      highlight: NO_OUTLINE,
      label: () => this.labelFor(slot),
      act: () => this.act(slot),
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
    return cap > 0 && slot.count < cap && box.count > 0;
  }

  private labelFor(slot: ShelfSlot): string | null {
    if (this.boxes.carried) return this.canStock(slot) ? 'Stock shelf' : null;
    return slot.count > 0 ? 'Take items' : null;
  }

  private act(slot: ShelfSlot): void {
    const box = this.boxes.carried;
    if (box) {
      if (!this.canStock(slot)) return;
      const def = PRODUCT_BY_ID[box.productId];
      const n = Math.min(box.count, slot.capacityFor(def) - slot.count);
      slot.productId = def.id;
      slot.count += n;
      this.dirty = true;
      haptic(14);
      this.boxes.consume(box, n);
      return;
    }
    if (slot.count > 0 && slot.def) {
      const id = slot.def.id;
      const n = Math.min(slot.count, slot.def.boxSize);
      slot.count -= n;
      if (slot.count === 0) slot.productId = null;
      this.dirty = true;
      haptic(14);
      this.boxes.createCarried(id, n);
    }
  }

  private infoFor(slot: ShelfSlot): InfoCardData | null {
    const box = this.boxes.carried;
    const def = slot.def;
    if (def) {
      const cap = slot.capacityFor(def);
      const cat = CATEGORIES.find((c) => c.id === def.category);
      return { key: `slot:${slot.id}:${slot.count}:${box?.productId ?? ''}`, title: def.name, sub: `${slot.count} / ${cap} on shelf`, tag: cat ? `${cat.icon} ${cat.label}` : def.sub };
    }
    if (box) {
      const bdef = PRODUCT_BY_ID[box.productId];
      const fits = slot.capacityFor(bdef) > 0;
      return { key: `slot:${slot.id}:empty:${box.productId}`, title: 'Empty slot', sub: fits ? `Holds up to ${slot.capacityFor(bdef)} ${bdef.name}` : `${bdef.name} is too tall here`, tag: fits ? 'Ready to stock' : 'Try a Low Bench' };
    }
    return null;
  }

  private rebuildInstances(): void {
    this.dirty = false;
    const counts = new Map<string, number>();
    for (const unit of this.units) {
      for (const slot of unit.slots) {
        const def = slot.def;
        if (!def || slot.count === 0) continue;
        const grid = slotGrid(def, unit.type);
        const mesh = this.meshFor(def);
        let idx = counts.get(def.id) ?? 0;
        const [w, h, d] = def.size;
        for (let i = 0; i < slot.count && idx < MAX_INSTANCES; i++, idx++) {
          const col = i % grid.cols;
          const row = Math.floor(i / grid.cols) % grid.rows;
          const layer = Math.floor(i / (grid.cols * grid.rows));
          LOCAL.makeTranslation(
            slot.frame.center.x + (col - (grid.cols - 1) / 2) * (w + ITEM_GAP),
            slot.frame.center.y + layer * h,
            slot.frame.frontZ - 0.012 - d / 2 - row * (d + ITEM_GAP),
          );
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

  /** Parent for instanced item meshes (set by the owner after construction). */
  readonly itemsRoot = new THREE.Group();
}
