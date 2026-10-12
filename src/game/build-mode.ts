import * as THREE from 'three';
import {
  BUILD_GRID,
  BUILD_LABEL,
  FRONT_CLEARANCE,
  MAX_SHELVES,
  MAX_VILLAS,
  SELL_REFUND,
  buildCost,
  type BuildKind,
  type ShelfSpot,
  type VillaSpot,
} from '../config/build';
import { SHELF_TYPES } from '../config/shelves';
import { VILLA_SIZE } from '../config/villas';
import { haptic } from '../core/haptics';
import type { NavGrid, Pt } from '../core/nav';
import { sfx } from '../core/sfx';
import { buildShelfGeometry } from '../models/shelf-model';
import { toast } from '../ui/toast';
import type { CollisionWorld } from '../world/colliders';
import { DOOR_INSIDE, QUEUE, STORE } from '../world/layout';
import { DELIVERY_PAD } from '../world/shelf-layout';
import type { BoxManager } from './boxes';
import { catPrice, type CatData } from './cat-data';
import type { ShelfManager, ShelfUnit } from './shelves';
import { addMoney, spendMoney } from './state';
import type { Villa, VillaManager } from './villas';

export type BuildTool = { mode: 'place'; kind: BuildKind } | { mode: 'move' } | { mode: 'sell' };

type Placed = { kind: 'shelf'; unit: ShelfUnit } | { kind: 'villa'; villa: Villa };

/** An item picked up with Move; goes back to `origin` if build mode is left. */
interface Held {
  kind: BuildKind;
  id: string;
  paid: number;
  slots?: Array<{ productId: string | null; count: number }>;
  cat?: CatData | null;
  origin: { x: number; z: number; yaw: number };
}

interface Plan {
  x: number;
  z: number;
  yaw: number;
  /** Footprint after rotation. */
  w: number;
  d: number;
  h: number;
  ok: boolean;
  reason: string;
}

const HALF_PI = Math.PI / 2;
const WALL_GAP = 0.02;
const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const CENTER = new THREE.Vector2(0, 0);
const GREEN = new THREE.Color('#5fe0a0');
const RED = new THREE.Color('#ff6b6b');
const AMBER = new THREE.Color('#ffc447');

/** Floors that must stay clear: entrance, delivery pad and the checkout queue. */
const RESERVED: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> = [
  { minX: STORE.minX, maxX: -5.2, minZ: 1.8, maxZ: 4.6 },
  { minX: DELIVERY_PAD.x - DELIVERY_PAD.w / 2 - 0.2, maxX: DELIVERY_PAD.x + DELIVERY_PAD.w / 2 + 0.2, minZ: DELIVERY_PAD.z - DELIVERY_PAD.d / 2 - 0.2, maxZ: STORE.maxZ },
  { minX: 0.6, maxX: 6.2, minZ: 3.1, maxZ: STORE.maxZ },
];

const footCache = new Map<string, { w: number; d: number; h: number }>();
function footprintOf(kind: BuildKind): { w: number; d: number; h: number } {
  let f = footCache.get(kind);
  if (!f) {
    if (kind === 'villa') f = { w: VILLA_SIZE.w + 0.05, d: VILLA_SIZE.d + 0.05, h: 1.5 };
    else {
      const g = buildShelfGeometry(SHELF_TYPES[kind]);
      f = { w: g.width, d: g.depth, h: g.height };
    }
    footCache.set(kind, f);
  }
  return f;
}

const newId = (kind: BuildKind): string => `${kind === 'villa' ? 'villa' : 'shelf'}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Build mode: pick a thing to buy (or Move / Sell), aim at the floor, and place it.
 * The ghost snaps to walls and neighbours and turns red when it would block a path.
 */
export class BuildMode {
  active = false;
  tool: BuildTool = { mode: 'place', kind: 'gondola' };
  held: Held | null = null;
  /** Latest message for the build bar. */
  status = { text: '', ok: true };
  private yaw = 0;
  private plan: Plan | null = null;
  private hover: Placed | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ghost = new THREE.Group();
  private readonly ghostBox: THREE.Mesh;
  private readonly arrow: THREE.Mesh;
  private readonly listeners: Array<() => void> = [];

  constructor(
    scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly shelves: ShelfManager,
    private readonly villas: VillaManager | null,
    private readonly colliders: CollisionWorld,
    private readonly nav: NavGrid,
    private readonly boxes: BoxManager,
  ) {
    this.raycaster.far = 9;
    const mat = new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.38, depthWrite: false });
    this.ghostBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 4).rotateX(HALF_PI), new THREE.MeshBasicMaterial({ color: '#ffffff', depthWrite: false }));
    this.arrow.position.y = 0.04;
    this.ghost.add(this.ghostBox, this.arrow);
    this.ghost.visible = false;
    this.ghost.renderOrder = 5;
    scene.add(this.ghost);
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  private changed(): void {
    for (const fn of this.listeners) fn();
  }

  // ----------------------------------------------------------------- lifecycle

  enter(): void {
    this.active = true;
    this.setTool({ mode: 'place', kind: 'gondola' });
  }

  exit(): void {
    if (this.held) this.putBack();
    this.active = false;
    this.ghost.visible = false;
    this.changed();
  }

  setTool(tool: BuildTool): void {
    if (this.held) this.putBack();
    this.tool = tool;
    this.hover = null;
    this.status = { text: '', ok: true };
    this.changed();
  }

  rotate(): void {
    this.yaw = (this.yaw + HALF_PI) % (Math.PI * 2);
    haptic(6);
  }

  // -------------------------------------------------------------------- update

  /** Call once per frame while active. */
  update(): void {
    if (!this.active) return;
    this.raycaster.setFromCamera(CENTER, this.camera);
    this.plan = null;
    this.hover = null;
    const placing = this.tool.mode === 'place' || this.held !== null;
    if (placing) {
      const kind = this.held?.kind ?? (this.tool.mode === 'place' ? this.tool.kind : 'gondola');
      const hit = this.raycaster.ray.intersectPlane(FLOOR, new THREE.Vector3());
      if (hit && hit.distanceTo(this.raycaster.ray.origin) < 9) this.plan = this.evaluate(kind, hit);
      this.showGhost(this.plan);
    } else {
      this.hover = this.pickTarget();
      this.showSelection(this.hover);
    }
    this.updateStatus();
  }

  private pickTarget(): Placed | null {
    const targets: THREE.Object3D[] = [...this.shelves.pickables.children, ...(this.villas?.pickables.children ?? [])];
    const hits = this.raycaster.intersectObjects(targets, false);
    return (hits[0]?.object.userData.placed as Placed | undefined) ?? null;
  }

  private showGhost(plan: Plan | null): void {
    this.ghost.visible = plan !== null;
    if (!plan) return;
    this.ghost.position.set(plan.x, 0, plan.z);
    this.ghost.rotation.y = plan.yaw;
    const f = this.held ? footprintOf(this.held.kind) : footprintOf(this.tool.mode === 'place' ? this.tool.kind : 'gondola');
    this.ghostBox.scale.set(f.w, f.h, f.d);
    this.ghostBox.position.y = f.h / 2;
    this.arrow.position.z = f.d / 2 + 0.28;
    (this.ghostBox.material as THREE.MeshBasicMaterial).color.copy(plan.ok ? GREEN : RED);
  }

  private showSelection(target: Placed | null): void {
    this.ghost.visible = target !== null;
    if (!target) return;
    const spot = target.kind === 'shelf' ? target.unit.spot : target.villa.spot;
    const kind: BuildKind = target.kind === 'shelf' ? target.unit.spot.type : 'villa';
    const f = footprintOf(kind);
    this.ghost.position.set(spot.x, 0, spot.z);
    this.ghost.rotation.y = spot.yaw;
    this.ghostBox.scale.set(f.w, f.h, f.d);
    this.ghostBox.position.y = f.h / 2;
    this.arrow.position.z = f.d / 2 + 0.28;
    (this.ghostBox.material as THREE.MeshBasicMaterial).color.copy(this.tool.mode === 'sell' ? RED : AMBER);
  }

  // ------------------------------------------------------------------ planning

  /** Everything currently standing in the shop (an item being moved is out of the world). */
  private allSpots(): Array<{ x: number; z: number; yaw: number; kind: BuildKind; w: number; d: number }> {
    const out: Array<{ x: number; z: number; yaw: number; kind: BuildKind; w: number; d: number }> = [];
    for (const u of this.shelves.units) {
      const f = footprintOf(u.spot.type);
      out.push({ ...u.spot, kind: u.spot.type, w: f.w, d: f.d });
    }
    for (const v of this.villas?.villas ?? []) {
      const f = footprintOf('villa');
      out.push({ ...v.spot, kind: 'villa', w: f.w, d: f.d });
    }
    return out;
  }

  private evaluate(kind: BuildKind, P: THREE.Vector3): Plan {
    const f = footprintOf(kind);
    const snap = (v: number): number => Math.round(v / BUILD_GRID) * BUILD_GRID;
    // Nearest wall wins if close enough: the unit sits flush with its back to it.
    const walls = [
      { yaw: 0, dist: P.z - STORE.minZ },
      { yaw: -HALF_PI, dist: STORE.maxX - P.x },
      { yaw: Math.PI, dist: STORE.maxZ - P.z },
      { yaw: HALF_PI, dist: P.x - STORE.minX },
    ].sort((a, b) => a.dist - b.dist);
    let yaw = this.yaw;
    let x = snap(P.x);
    let z = snap(P.z);
    let wall: number | null = null;
    if (walls[0].dist < 1.0) {
      wall = walls[0].yaw;
      yaw = wall;
      const half = f.d / 2 + WALL_GAP;
      if (wall === 0) z = STORE.minZ + half;
      else if (wall === Math.PI) z = STORE.maxZ - half;
      else if (wall === -HALF_PI) x = STORE.maxX - half;
      else x = STORE.minX + half;
    }
    const sideways = Math.abs(Math.sin(yaw)) > 0.5;
    const w = sideways ? f.d : f.w;
    const d = sideways ? f.w : f.d;
    x = Math.min(STORE.maxX - w / 2, Math.max(STORE.minX + w / 2, x));
    z = Math.min(STORE.maxZ - d / 2, Math.max(STORE.minZ + d / 2, z));

    // Butt up against a neighbour on the same wall.
    if (wall !== null) {
      const alongX = wall === 0 || wall === Math.PI;
      for (const o of this.allSpots()) {
        const osw = Math.abs(Math.sin(o.yaw)) > 0.5;
        const ow = osw ? o.d : o.w;
        const od = osw ? o.w : o.d;
        if (Math.abs(o.yaw - yaw) > 0.1) continue;
        const myHalf = (alongX ? w : d) / 2;
        const oHalf = (alongX ? ow : od) / 2;
        const oc = alongX ? o.x : o.z;
        const mine = alongX ? x : z;
        for (const target of [oc + oHalf + myHalf + 0.005, oc - oHalf - myHalf - 0.005]) {
          if (Math.abs(mine - target) < 0.3) {
            if (alongX) x = target;
            else z = target;
          }
        }
      }
    }

    const plan: Plan = { x, z, yaw, w, d, h: f.h, ok: true, reason: '' };
    const fail = (reason: string): Plan => {
      plan.ok = false;
      plan.reason = reason;
      return plan;
    };
    const eps = 0.004;
    if (x - w / 2 < STORE.minX - eps || x + w / 2 > STORE.maxX + eps || z - d / 2 < STORE.minZ - eps || z + d / 2 > STORE.maxZ + eps) return fail('Outside the shop');
    if (this.colliders.overlapsBox(x, z, w / 2 - 0.01, d / 2 - 0.01)) return fail("Something's in the way");
    for (const r of RESERVED) {
      if (x + w / 2 > r.minX && x - w / 2 < r.maxX && z + d / 2 > r.minZ && z - d / 2 < r.maxZ) return fail('Keep the entrance, queue and delivery area clear');
    }
    const front = this.standFor(x, z, yaw, f.d);
    if (front.x < STORE.minX || front.x > STORE.maxX || front.z < STORE.minZ || front.z > STORE.maxZ || this.colliders.overlapsBox(front.x, front.z, 0.25, 0.25)) return fail('Needs free floor in front');
    // Everything must stay reachable from the door with this unit in place.
    const temp = this.colliders.addCentered(x, z, w, d);
    const targets: Pt[] = [front, { x: QUEUE.x, z: QUEUE.z }, { x: QUEUE.x - 3 * QUEUE.step, z: QUEUE.z }];
    for (const o of this.allSpots()) targets.push(this.standFor(o.x, o.z, o.yaw, o.d));
    const blocked = this.nav.firstUnreachable(DOOR_INSIDE, targets);
    this.colliders.remove(temp);
    if (blocked) return fail('This would block the way for customers');
    return plan;
  }

  private standFor(x: number, z: number, yaw: number, depth: number): Pt {
    const reach = depth / 2 + FRONT_CLEARANCE;
    return { x: x + Math.sin(yaw) * reach, z: z + Math.cos(yaw) * reach };
  }

  // ------------------------------------------------------------------- actions

  /** Label for the big action button (null = nothing to do right now). */
  label(): string | null {
    if (!this.active) return null;
    if (this.held) return this.plan?.ok ? 'Put down' : null;
    if (this.tool.mode === 'place') return this.plan?.ok ? `Buy · $${this.costOf(this.tool.kind)}` : null;
    if (!this.hover) return null;
    if (this.tool.mode === 'move') return 'Pick up';
    return `Sell · +$${this.refundOf(this.hover)}`;
  }

  confirm(): void {
    if (!this.active) return;
    if (this.held) return this.dropHeld();
    if (this.tool.mode === 'place') return this.buy(this.tool.kind);
    if (!this.hover) return;
    if (this.tool.mode === 'move') return this.pickUp(this.hover);
    this.sell(this.hover);
  }

  costOf(kind: BuildKind): number {
    return buildCost(kind, this.villas?.villas.length ?? 1);
  }

  private refundOf(p: Placed): number {
    const spot = p.kind === 'shelf' ? p.unit.spot : p.villa.spot;
    let refund = spot.paid * SELL_REFUND;
    if (p.kind === 'villa' && p.villa.cat) refund += catPrice(p.villa.cat.data);
    return Math.round(refund);
  }

  private counts(): { shelves: number; villas: number } {
    return { shelves: this.shelves.units.length, villas: this.villas?.villas.length ?? 0 };
  }

  private buy(kind: BuildKind): void {
    const plan = this.plan;
    if (!plan?.ok) return;
    const c = this.counts();
    if (kind === 'villa' ? c.villas >= MAX_VILLAS : c.shelves >= MAX_SHELVES) {
      toast(`You can't fit more ${kind === 'villa' ? 'villas' : 'shelves'}`, 'bad');
      return;
    }
    const cost = this.costOf(kind);
    if (!spendMoney(cost)) {
      toast(`Not enough money · need $${cost}`, 'bad');
      sfx.error();
      haptic([20, 40, 20]);
      return;
    }
    this.place(kind, plan, newId(kind), cost);
    sfx.done();
    haptic([10, 30, 14]);
    toast(`${BUILD_LABEL[kind].name} placed`, 'good');
    this.changed();
  }

  private place(kind: BuildKind, plan: Plan, id: string, paid: number, held?: Held): void {
    if (kind === 'villa') {
      const spot: VillaSpot = { id, x: plan.x, z: plan.z, yaw: plan.yaw, paid };
      this.villas?.addVilla(spot, held?.cat ?? null);
    } else {
      const spot: ShelfSpot = { id, type: kind, x: plan.x, z: plan.z, yaw: plan.yaw, paid };
      const unit = this.shelves.addUnit(spot);
      held?.slots?.forEach((s, i) => {
        const slot = unit.slots[i];
        if (slot && s.productId) {
          slot.productId = s.productId;
          slot.count = s.count;
        }
      });
      this.shelves.markDirty();
    }
  }

  private pickUp(p: Placed): void {
    if (p.kind === 'shelf') {
      const u = p.unit;
      this.held = {
        kind: u.spot.type,
        id: u.spot.id,
        paid: u.spot.paid,
        slots: u.slots.map((s) => ({ productId: s.productId, count: s.count })),
        origin: { x: u.spot.x, z: u.spot.z, yaw: u.spot.yaw },
      };
      this.shelves.removeUnit(u);
    } else {
      const v = p.villa;
      this.held = { kind: 'villa', id: v.spot.id, paid: v.spot.paid, cat: this.villas?.removeVilla(v) ?? null, origin: { x: v.spot.x, z: v.spot.z, yaw: v.spot.yaw } };
    }
    this.yaw = this.held.origin.yaw;
    haptic(12);
    this.changed();
  }

  private dropHeld(): void {
    const h = this.held;
    const plan = this.plan;
    if (!h || !plan?.ok) return;
    this.place(h.kind, plan, h.id, h.paid, h);
    this.held = null;
    sfx.cash();
    haptic([8, 20, 8]);
    this.changed();
  }

  /** Leaving build mode (or switching tool) while carrying: return it where it was. */
  private putBack(): void {
    const h = this.held;
    if (!h) return;
    const f = footprintOf(h.kind);
    const sideways = Math.abs(Math.sin(h.origin.yaw)) > 0.5;
    this.place(h.kind, { ...h.origin, w: sideways ? f.d : f.w, d: sideways ? f.w : f.d, h: f.h, ok: true, reason: '' }, h.id, h.paid, h);
    this.held = null;
  }

  private sell(p: Placed): void {
    const refund = this.refundOf(p);
    if (p.kind === 'shelf') {
      const contents = this.shelves.removeUnit(p.unit);
      if (contents.length > 0) {
        this.boxes.spawnBoxes(contents);
        toast('Stock from the shelf is on the delivery pad', 'info');
      }
    } else if (this.villas) {
      this.villas.removeVilla(p.villa);
    }
    addMoney(refund);
    sfx.coin();
    haptic([10, 30, 10]);
    toast(`Sold · +$${refund}`, 'good');
    this.changed();
  }

  private updateStatus(): void {
    let text = '';
    let ok = true;
    if (this.tool.mode === 'place' || this.held) {
      if (!this.plan) text = 'Aim at the floor';
      else if (!this.plan.ok) {
        text = this.plan.reason;
        ok = false;
      } else if (this.held) text = 'Tap Put down to place it here';
      else if (this.tool.mode === 'place') {
        const k = this.tool.kind;
        if (k === 'villa' && this.counts().villas >= MAX_VILLAS) text = 'Villa limit reached';
        else text = `${BUILD_LABEL[k].name} · $${this.costOf(k)} · rotate near open floor`;
      }
    } else if (this.tool.mode === 'move') text = this.hover ? 'Tap Pick up to move it' : 'Aim at a shelf or villa to move it';
    else text = this.hover ? 'Sell for a refund (stock goes back to boxes)' : 'Aim at a shelf or villa to sell it';
    if (text !== this.status.text || ok !== this.status.ok) {
      this.status = { text, ok };
      this.changed();
    }
  }
}

