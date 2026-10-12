import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ProductDef } from '../config/products';
import { cachedGeometry, cachedMaterial } from '../core/cache';
import { CARTON_SOLID_UV } from './product-labels';
import { CARTON_SIZE, cartonGeometry, cartonMaterial, getProductModel } from './product-factory';

const [BW, BH, BD] = CARTON_SIZE;
const T = 0.012;
const FLAP_LEN = 0.17;
/** How far the flaps flare out when fully open (radians about the hinge). */
const FLAP_OPEN = 3.9;

const easeOutBack = (t: number): number => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

/** Pushes UVs of faces rejected by `keep` onto the solid cardboard texel. */
function solidify(g: THREE.BufferGeometry, keep: (n: THREE.Vector3) => boolean): void {
  const nor = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  const n = new THREE.Vector3();
  for (let i = 0; i < nor.count; i++) {
    n.fromBufferAttribute(nor, i);
    if (!keep(n)) uv.setXY(i, CARTON_SOLID_UV[0], CARTON_SOLID_UV[1]);
  }
}

function panel(w: number, h: number, d: number, x: number, y: number, z: number, keep: (n: THREE.Vector3) => boolean): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(0.004, T / 2 - 0.001));
  g.translate(x, y, z);
  solidify(g, keep);
  return g;
}

/** Open-top carton: four walls and a floor (front/back outer faces keep the sticker). */
function openBodyGeometry(): THREE.BufferGeometry {
  return cachedGeometry('carton-open-body', () => {
    const parts = [
      panel(BW, BH, T, 0, BH / 2, BD / 2 - T / 2, (n) => n.z > 0.55),
      panel(BW, BH, T, 0, BH / 2, -BD / 2 + T / 2, (n) => n.z < -0.55),
      panel(T, BH, BD, -BW / 2 + T / 2, BH / 2, 0, () => false),
      panel(T, BH, BD, BW / 2 - T / 2, BH / 2, 0, () => false),
      panel(BW, T, BD, 0, T / 2, 0, () => false),
    ];
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    return merged;
  });
}

/** Flap that extends from its hinge along -Z (inward when closed). */
function flapGeometry(width: number): THREE.BufferGeometry {
  return cachedGeometry(`carton-flap:${width}`, () => {
    const g = new RoundedBoxGeometry(width - 0.006, T, FLAP_LEN, 3, 0.004);
    g.translate(0, 0, -FLAP_LEN / 2);
    solidify(g, () => false);
    return g;
  });
}

const flapMaterial = (): THREE.Material =>
  cachedMaterial('carton-flap-mat', () => new THREE.MeshStandardMaterial({ color: '#e6b97f', roughness: 0.85 }));

interface ItemLayout {
  /** Item lies on its back (label facing up) instead of standing. */
  flat: boolean;
  cols: number;
  rows: number;
  layers: number;
  scale: number;
  /** Packed footprint / height of one item after orientation (before scale). */
  a: number;
  b: number;
  c: number;
}

const GAP = 0.008;
const MAX_ITEM_TOP = BH - 0.05;

/**
 * Packs `def.boxSize` items inside the carton: tries standing and lying
 * orientations and every cols x rows grid, keeping the largest scale at
 * which the whole stack stays below the rim.
 */
function layoutFor(def: ProductDef): ItemLayout {
  const [w, h, d] = def.size;
  const innerW = BW - T * 2 - 0.02;
  const innerD = BD - T * 2 - 0.02;
  const maxH = MAX_ITEM_TOP - T;
  let best: ItemLayout | null = null;
  for (const flat of [false, true]) {
    const a = w;
    const b = flat ? d : h;
    const c = flat ? h : d;
    for (let cols = 1; cols <= 8; cols++) {
      for (let rows = 1; rows <= 8; rows++) {
        const layers = Math.ceil(def.boxSize / (cols * rows));
        const scale = Math.min(
          1,
          (innerW - (cols - 1) * GAP) / (cols * a),
          (innerD - (rows - 1) * GAP) / (rows * c),
          maxH / (layers * b),
        );
        // Prefer bigger items; on ties prefer shorter stacks, then upright.
        const better =
          !best ||
          scale > best.scale + 1e-3 ||
          (Math.abs(scale - best.scale) <= 1e-3 && (layers < best.layers || (layers === best.layers && !flat && best.flat)));
        if (better) best = { flat, cols, rows, layers, scale, a, b, c };
      }
    }
  }
  return best as ItemLayout;
}

/**
 * Visual for a carton that can unbox itself: flaps swing open and the items
 * pop up inside; items are one InstancedMesh so any count costs one draw call.
 */
export class CartonView {
  readonly group = new THREE.Group();
  private readonly closed: THREE.Mesh;
  private readonly open = new THREE.Group();
  private readonly hinges: THREE.Group[] = [];
  private items: THREE.InstancedMesh | null = null;
  private readonly layout: ItemLayout;
  private readonly matrix = new THREE.Matrix4();
  private readonly pos = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly scl = new THREE.Vector3();
  /** 0 = closed, animates to 1 (fully open, items popped in). */
  private openT = 0;
  private opening = false;
  private shown = 0;
  private dirty = false;

  constructor(
    private readonly def: ProductDef,
    private count: number,
  ) {
    this.layout = layoutFor(def);
    if (this.layout.flat) this.quat.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    this.closed = new THREE.Mesh(cartonGeometry(), cartonMaterial(def));
    this.closed.castShadow = true;
    this.closed.receiveShadow = true;
    this.group.add(this.closed);

    const body = new THREE.Mesh(openBodyGeometry(), cartonMaterial(def));
    body.castShadow = true;
    this.open.add(body);
    const specs: Array<[number, number, number, number, number]> = [
      [0, BH, BD / 2, 0, BW],
      [0, BH, -BD / 2, Math.PI, BW],
      [BW / 2, BH, 0, Math.PI / 2, BD],
      [-BW / 2, BH, 0, -Math.PI / 2, BD],
    ];
    for (const [x, y, z, yaw, width] of specs) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      pivot.rotation.y = yaw;
      const hinge = new THREE.Group();
      const flap = new THREE.Mesh(flapGeometry(width), flapMaterial());
      flap.castShadow = true;
      hinge.add(flap);
      pivot.add(hinge);
      this.open.add(pivot);
      this.hinges.push(hinge);
    }
    this.open.visible = false;
    this.group.add(this.open);
  }

  get isOpen(): boolean {
    return this.open.visible;
  }

  /** Unbox: swap to the open carton and start the flap / pop-in animation. */
  unbox(): void {
    if (this.isOpen) return;
    this.closed.visible = false;
    this.open.visible = true;
    this.opening = true;
    this.openT = 0;
    const model = getProductModel(this.def);
    this.items = new THREE.InstancedMesh(model.geometry, model.material, Math.max(this.count, 1));
    this.items.castShadow = false;
    this.items.frustumCulled = false;
    this.items.count = this.count;
    this.shown = this.count;
    this.group.add(this.items);
    this.writeItems();
  }

  /** Items currently inside (drives the visible stack). */
  setCount(n: number): void {
    this.count = n;
    if (!this.items) return;
    this.items.count = Math.min(n, this.items.instanceMatrix.count);
    this.shown = this.items.count;
    this.dirty = true;
  }

  /** World position where item `i` currently sits (box local -> world). */
  itemWorldPosition(i: number, out: THREE.Vector3): THREE.Vector3 {
    const { x, y, z } = this.itemLocal(i);
    const { b, scale } = this.layout;
    return out.set(x, y + (this.layout.flat ? 0 : b * scale * 0.5), z).applyMatrix4(this.group.matrixWorld);
  }

  update(dt: number): void {
    if (this.opening) {
      this.openT = Math.min(1, this.openT + dt / 0.55);
      // Flaps swing out over the first 60 %, with a little overshoot.
      const f = easeOutBack(clamp01(this.openT / 0.6));
      for (const h of this.hinges) h.rotation.x = FLAP_OPEN * f;
      this.writeItems();
      if (this.openT >= 1) this.opening = false;
    } else if (this.dirty) {
      this.dirty = false;
      this.writeItems();
    }
  }

  /** Origin (bottom centre of an upright item, centre of a lying one) for item `i`. */
  private itemLocal(i: number): { x: number; y: number; z: number } {
    const { cols, rows, scale, a, b, c, flat } = this.layout;
    const perLayer = cols * rows;
    const layer = Math.floor(i / perLayer);
    const idx = i % perLayer;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const base = T + layer * b * scale;
    return {
      x: (col - (cols - 1) / 2) * (a * scale + GAP),
      // Lying items rotate about their origin, which sits mid-thickness.
      y: flat ? base + (b * scale) / 2 : base,
      // ...and their long side runs along z, so shift to centre it in the row.
      z: (row - (rows - 1) / 2) * (c * scale + GAP) + (flat ? (c * scale) / 2 : 0),
    };
  }

  private writeItems(): void {
    if (!this.items) return;
    const s0 = this.layout.scale;
    for (let i = 0; i < this.shown; i++) {
      const { x, y, z } = this.itemLocal(i);
      // Staggered pop: items start at t=0.25 and each trails the previous.
      const t = this.opening ? clamp01((this.openT - 0.25 - i * 0.035) / 0.35) : 1;
      const k = t <= 0 ? 0.001 : easeOutBack(t);
      this.pos.set(x, y + (1 - Math.min(t, 1)) * 0.05, z);
      this.scl.setScalar(s0 * Math.max(k, 0.001));
      this.matrix.compose(this.pos, this.quat, this.scl);
      this.items.setMatrixAt(i, this.matrix);
    }
    this.items.instanceMatrix.needsUpdate = true;
  }
}
