import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Colour for a vertex at model-space position `p` (normal `n`). */
export type ColorFn = (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color;
/** Up to two bone influences: [boneA, boneB, weightOfB]. */
export type SkinFn = (p: THREE.Vector3) => [number, number, number];
/** Offset along the normal for a vertex (fluffy fur), in metres. */
export type DisplaceFn = (p: THREE.Vector3) => number;

const v = new THREE.Vector3();
const n = new THREE.Vector3();

/**
 * Like PartBuilder but for ONE skinned mesh: every primitive gets per-vertex
 * colour, optional fur displacement and bone weights, all merged (indexed)
 * into a single geometry -> one draw call per cat.
 */
export class SkinnedPartBuilder {
  private readonly parts: THREE.BufferGeometry[] = [];

  add(
    geometry: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    color: THREE.ColorRepresentation | ColorFn,
    skin: number | SkinFn,
    displace?: DisplaceFn,
  ): this {
    const g = geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    if (!g.index) g.setIndex([...Array(g.getAttribute('position').count).keys()]);
    g.applyMatrix4(matrix);

    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const nor = g.getAttribute('normal') as THREE.BufferAttribute;
    const count = pos.count;
    const colors = new Float32Array(count * 3);
    const skinIndex = new Uint16Array(count * 4);
    const skinWeight = new Float32Array(count * 4);
    const fixed = typeof color === 'function' ? null : new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nor, i);
      if (displace) {
        const d = displace(v);
        if (d !== 0) {
          v.addScaledVector(n, d);
          pos.setXYZ(i, v.x, v.y, v.z);
        }
      }
      const c = fixed ?? (color as ColorFn)(v, n);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      if (typeof skin === 'number') {
        skinIndex[i * 4] = skin;
        skinWeight[i * 4] = 1;
      } else {
        const [a, b, w] = skin(v);
        skinIndex[i * 4] = a;
        skinIndex[i * 4 + 1] = b;
        skinWeight[i * 4] = 1 - w;
        skinWeight[i * 4 + 1] = w;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    this.parts.push(g);
    return this;
  }

  build(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    if (!merged) throw new Error('SkinnedPartBuilder: merge failed');
    return merged;
  }
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const s = new THREE.Vector3();
const t = new THREE.Vector3();

/** Compose a TRS matrix from plain numbers. */
export function trs(
  pos: readonly [number, number, number],
  rot: readonly [number, number, number] = [0, 0, 0],
  scale: number | readonly [number, number, number] = 1,
): THREE.Matrix4 {
  const sc = typeof scale === 'number' ? [scale, scale, scale] : scale;
  return m4.clone().compose(
    t.set(pos[0], pos[1], pos[2]),
    q.setFromEuler(e.set(rot[0], rot[1], rot[2])),
    s.set(sc[0], sc[1], sc[2]),
  );
}
