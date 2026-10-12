import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ProductDef } from '../config/products';
import { cachedGeometry, cachedMaterial } from '../core/cache';
import { shapes } from './character-parts';
import { PartBuilder, partMaterial } from './part-builder';
import { CARTON_SOLID_UV, cartonTexture, labelSpec, productLabelTexture, solidUv } from './product-labels';

export interface ProductModel {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/** Carton outer size in metres. */
export const CARTON_SIZE = [0.46, 0.32, 0.34] as const;

const cache = new Map<string, ProductModel>();

/** Moves vertices whose normal fails `keep` onto a single solid-colour texel. */
function remapUvs(g: THREE.BufferGeometry, keep: (n: THREE.Vector3) => boolean, uv: [number, number]): void {
  const nor = g.getAttribute('normal');
  const uvs = g.getAttribute('uv');
  const n = new THREE.Vector3();
  for (let i = 0; i < nor.count; i++) {
    n.fromBufferAttribute(nor, i);
    if (!keep(n)) uvs.setXY(i, uv[0], uv[1]);
  }
  uvs.needsUpdate = true;
}

const rbox = (w: number, h: number, d: number, r: number, seg = 4): THREE.BufferGeometry => {
  const g = new RoundedBoxGeometry(w, h, d, seg, r);
  g.translate(0, h / 2, 0);
  return g;
};

const frontBack = (n: THREE.Vector3): boolean => Math.abs(n.z) > 0.55;
const sides = (n: THREE.Vector3): boolean => Math.abs(n.y) < 0.55;

function texturedModel(def: ProductDef): ProductModel {
  const [w, h, d] = def.size;
  const spec = labelSpec(def);
  const uv = solidUv(spec);
  let geometry: THREE.BufferGeometry;

  switch (def.kind) {
    case 'bag': {
      geometry = rbox(w, h, d, 0.022);
      const pos = geometry.getAttribute('position');
      // Crimped top: pinch depth toward the top, like a sealed bag.
      for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) - h * 0.82) / (h * 0.18);
        if (t > 0) pos.setZ(i, pos.getZ(i) * (1 - Math.min(t, 1) * 0.55));
      }
      geometry.computeVertexNormals();
      remapUvs(geometry, frontBack, uv);
      break;
    }
    case 'pouch':
      geometry = rbox(w, h, d, 0.012, 3);
      remapUvs(geometry, frontBack, uv);
      break;
    case 'box':
      geometry = rbox(w, h, d, 0.016);
      remapUvs(geometry, frontBack, uv);
      break;
    case 'can': {
      const body = new THREE.CylinderGeometry(w / 2, w / 2, h - 0.008, 28, 1);
      body.translate(0, (h - 0.008) / 2, 0);
      const lid = new THREE.CylinderGeometry(w / 2 + 0.003, w / 2 + 0.003, 0.012, 28, 1);
      lid.translate(0, h - 0.006, 0);
      remapUvs(body, sides, uv);
      remapUvs(lid, () => false, uv);
      geometry = mergeGeometries([body, lid], false);
      break;
    }
    case 'tube': {
      const body = new THREE.CylinderGeometry(w * 0.46, w / 2, h - 0.03, 24, 1);
      body.translate(0, (h - 0.03) / 2, 0);
      const cap = new THREE.CylinderGeometry(w * 0.4, w * 0.44, 0.03, 24, 1);
      cap.translate(0, h - 0.015, 0);
      remapUvs(body, sides, uv);
      remapUvs(cap, () => false, uv);
      geometry = mergeGeometries([body, cap], false);
      break;
    }
    case 'bucket': {
      const r = w / 2;
      const pts = [
        [0, 0], [r * 0.8, 0], [r * 0.82, 0.012], [r * 0.98, h * 0.9], [r * 1.04, h * 0.93],
        [r * 1.0, h * 0.97], [r * 0.96, h], [0, h],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      geometry = new THREE.LatheGeometry(pts, 28);
      geometry.computeVertexNormals();
      remapUvs(geometry, (n) => Math.abs(n.y) < 0.6, uv);
      break;
    }
    default:
      throw new Error(`not a textured kind: ${def.kind}`);
  }
  const material = cachedMaterial(`prod-mat:${def.id}`, () =>
    new THREE.MeshStandardMaterial({ map: productLabelTexture(def), roughness: 0.55 }),
  );
  return { geometry, material };
}

const unitBox = (): THREE.BufferGeometry => cachedGeometry('p-unit-box', () => new RoundedBoxGeometry(1, 1, 1, 3, 0.12));
const torus = (R: number, r: number, arc = Math.PI * 2): THREE.BufferGeometry =>
  cachedGeometry(`p-torus:${R}:${r}:${arc}`, () => new THREE.TorusGeometry(R, r, 10, 28, arc));
const dome = (): THREE.BufferGeometry =>
  cachedGeometry('p-dome', () => new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2));

function coloredModel(def: ProductDef): ProductModel {
  const b = new PartBuilder();
  const { color: c, accent: a } = def;
  const S = shapes;
  switch (def.kind) {
    case 'wand': {
      b.add(S.capsule(0.014, 0.1), a, [0, 0.07, 0]);
      b.add(S.sphere(), '#f7d774', [0, 0.003, 0], [0, 0, 0], [0.017, 0.012, 0.017]);
      b.add(S.capsule(0.0045, 0.2), '#e8d5b7', [0, 0.22, 0]);
      const cols = [c, '#9fd8ff', '#ffd166', '#c9a6ff', '#ff8fab'];
      cols.forEach((col, i) => {
        const ang = (i - 2) * 0.32;
        b.add(S.sphere(), col, [Math.sin(ang) * 0.03, 0.365 + Math.cos(ang) * 0.01, 0], [0, 0, -ang], [0.017, 0.062, 0.006]);
      });
      b.add(S.sphere(), '#f7d774', [0, 0.322, 0], [0, 0, 0], 0.012);
      break;
    }
    case 'mouse': {
      b.add(S.sphere(), c, [0, 0.03, -0.005], [0, 0, 0], [0.036, 0.03, 0.052]);
      b.add(S.sphere(), '#ff9fb5', [0, 0.027, 0.052], [0, 0, 0], 0.01);
      for (const s of [-1, 1]) {
        b.add(S.sphere(), '#ff9fb5', [s * 0.026, 0.05, 0.018], [0.2, s * 0.3, 0], [0.018, 0.018, 0.005]);
        b.add(S.sphere(), '#2f2b3d', [s * 0.016, 0.04, 0.042], [0, 0, 0], 0.005);
      }
      b.add(S.capsule(0.004, 0.07), '#ff9fb5', [0.02, 0.016, -0.075], [Math.PI / 2, 0, 0.5]);
      b.add(S.sphere(), '#f7d774', [0, 0.012, 0.015], [0, 0, 0], 0.008);
      break;
    }
    case 'yarn': {
      b.add(unitBox(), '#fff4e2', [0, 0.006, 0], [0, 0, 0], [0.18, 0.012, 0.18]);
      const balls: Array<[number, number, string]> = [[-0.045, 0.035, c], [0.05, 0.03, '#ffd166'], [0, -0.05, '#ff8fab']];
      for (const [x, z, col] of balls) {
        b.add(S.sphere(), col, [x, 0.052, z], [0, 0, 0], 0.04);
        b.add(torus(0.04, 0.003), '#ffffff', [x, 0.052, z], [Math.PI / 2, 0.3, 0]);
        b.add(torus(0.04, 0.003), '#ffffff', [x, 0.052, z], [0.5, 0, 0.8]);
      }
      break;
    }
    case 'cushion': {
      b.add(torus(0.12, 0.045), c, [0, 0.045, 0], [Math.PI / 2, 0, 0]);
      b.add(S.cylinder(0.125, 0.125, 0.05), '#fff3e0', [0, 0.03, 0]);
      b.add(S.sphere(), a, [0, 0.058, 0.0], [0, 0, 0], [0.1, 0.012, 0.1]);
      break;
    }
    case 'cave': {
      b.add(S.cylinder(0.18, 0.18, 0.03), '#fff3e0', [0, 0.015, 0]);
      b.add(dome(), c, [0, 0.02, 0], [0, 0, 0], [0.17, 0.28, 0.16]);
      b.add(S.sphere(), '#33405c', [0, 0.1, 0.12], [0, 0, 0], [0.075, 0.09, 0.05]);
      b.add(torus(0.082, 0.014), a, [0, 0.1, 0.152], [0, 0, 0]);
      break;
    }
    case 'scratcher': {
      b.add(unitBox(), a, [0, 0.014, 0], [0, 0, 0], [0.3, 0.028, 0.06]);
      b.add(unitBox(), c, [0, 0.215, 0], [0, 0, 0], [0.28, 0.4, 0.035]);
      for (let i = 0; i < 5; i++) b.add(unitBox(), a, [0, 0.07 + i * 0.07, 0.003], [0, 0, 0], [0.28, 0.012, 0.04]);
      b.add(S.sphere(), '#ff8fab', [0, 0.36, 0.02], [0, 0, 0], [0.025, 0.02, 0.006]);
      break;
    }
    case 'collar': {
      b.add(unitBox(), '#fff4e2', [0, 0.07, -0.007], [0, 0, 0], [0.1, 0.14, 0.012]);
      b.add(torus(0.034, 0.0075), c, [0, 0.082, 0.004]);
      b.add(unitBox(), '#f7d774', [0, 0.116, 0.004], [0, 0, 0], [0.016, 0.012, 0.018]);
      b.add(S.sphere(), '#f7d774', [0, 0.04, 0.012], [0, 0, 0], 0.011);
      b.add(S.capsule(0.0035, 0.025), a, [0, 0.025, 0.01], [0, 0, 0]);
      break;
    }
    default:
      throw new Error(`not a coloured kind: ${def.kind}`);
  }
  return { geometry: b.build(), material: partMaterial() };
}

const TEXTURED = new Set(['bag', 'pouch', 'can', 'tube', 'bucket', 'box']);

/** Shared geometry + material for a product (bottom-centre origin, front +Z). */
export function getProductModel(def: ProductDef): ProductModel {
  let m = cache.get(def.id);
  if (!m) {
    m = TEXTURED.has(def.kind) ? texturedModel(def) : coloredModel(def);
    cache.set(def.id, m);
  }
  return m;
}

/** Delivery carton geometry (one shared mesh shape, per-product material). */
export function cartonGeometry(): THREE.BufferGeometry {
  return cachedGeometry('carton-geo', () => {
    const [w, h, d] = CARTON_SIZE;
    const g = new RoundedBoxGeometry(w, h, d, 4, 0.025);
    g.translate(0, h / 2, 0);
    remapUvs(g, frontBack, CARTON_SOLID_UV);
    return g;
  });
}

export function cartonMaterial(def: ProductDef): THREE.Material {
  return cachedMaterial(`carton-mat:${def.id}`, () =>
    new THREE.MeshStandardMaterial({ map: cartonTexture(def), roughness: 0.85 }),
  );
}
