import * as THREE from 'three';
import type { ProductDef } from '../config/products';
import { cachedGeometry, cachedMaterial, canvasTexture, makeCanvas } from '../core/cache';
import type { ShelfUnit } from './shelves';

const TAG_W = 0.27;
const TAG_H = 0.1;
const MAX_TAGS = 120;
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler(-0.32, 0, 0);
const P = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

const money = (v: number): string => `$${v.toFixed(2)}`;

function tagMaterial(def: ProductDef): THREE.Material {
  return cachedMaterial(`price-tag:${def.id}:${def.price}`, () => {
    const [c, g] = makeCanvas(256, 96);
    g.fillStyle = '#fffaf0';
    g.beginPath();
    g.roundRect(2, 2, 252, 92, 16);
    g.fill();
    g.fillStyle = def.accent;
    g.fillRect(2, 2, 252, 16);
    g.fillStyle = '#3a2f2a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 22px system-ui, sans-serif';
    g.fillText(def.name.length > 18 ? def.name.slice(0, 17) + '…' : def.name, 128, 36, 236);
    g.font = '800 40px system-ui, sans-serif';
    g.fillText(money(def.price), 128, 69);
    return new THREE.MeshBasicMaterial({ map: canvasTexture(c), side: THREE.DoubleSide });
  });
}

/** Small shelf-edge price cards: one instanced mesh per product, one card per stocked slot. */
export class PriceTagLayer {
  readonly root = new THREE.Group();
  private readonly meshes = new Map<string, THREE.InstancedMesh>();

  private meshFor(def: ProductDef): THREE.InstancedMesh {
    let m = this.meshes.get(def.id);
    if (!m) {
      const geo = cachedGeometry('price-tag-plane', () => new THREE.PlaneGeometry(TAG_W, TAG_H));
      m = new THREE.InstancedMesh(geo, tagMaterial(def), MAX_TAGS);
      m.frustumCulled = false;
      m.count = 0;
      m.visible = false;
      this.meshes.set(def.id, m);
      this.root.add(m);
    }
    return m;
  }

  rebuild(units: ShelfUnit[]): void {
    const counts = new Map<string, number>();
    for (const unit of units) {
      for (const slot of unit.slots) {
        const def = slot.def;
        if (!def || slot.committed === 0) continue;
        const mesh = this.meshFor(def);
        const i = counts.get(def.id) ?? 0;
        if (i >= MAX_TAGS) continue;
        counts.set(def.id, i + 1);
        const f = slot.frame;
        // Card leans back against the front lip of the board.
        P.set(f.center.x, f.center.y + TAG_H / 2 * Math.cos(0.32) + 0.004, f.frontZ + 0.012);
        Q.setFromEuler(E);
        M.multiplyMatrices(unit.matrix, new THREE.Matrix4().compose(P, Q, ONE));
        mesh.setMatrixAt(i, M);
      }
    }
    for (const [id, mesh] of this.meshes) {
      const n = counts.get(id) ?? 0;
      mesh.count = n;
      mesh.visible = n > 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
