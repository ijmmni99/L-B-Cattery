import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cachedMaterial } from '../core/cache';

type Vec3 = readonly [number, number, number];

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

/**
 * Bakes several coloured primitives into ONE vertex-coloured geometry, so a
 * rigid body part (a whole head with hair and face, a leg with its shoe)
 * costs a single draw call. Pair with `partMaterial()`.
 */
export class PartBuilder {
  private readonly parts: THREE.BufferGeometry[] = [];

  add(
    geometry: THREE.BufferGeometry,
    color: THREE.ColorRepresentation,
    position: Vec3 = [0, 0, 0],
    rotation: Vec3 = [0, 0, 0],
    scale: Vec3 | number = 1,
  ): this {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
    tmpPos.set(position[0], position[1], position[2]);
    tmpQuat.setFromEuler(tmpEuler.set(rotation[0], rotation[1], rotation[2]));
    tmpScale.set(s[0], s[1], s[2]);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    g = g.applyMatrix4(tmpMatrix);

    const c = new THREE.Color(color);
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(g);
    return this;
  }

  build(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    if (!merged) throw new Error('PartBuilder: merge failed');
    merged.computeBoundingSphere();
    return merged;
  }
}

/** Shared soft material for all vertex-coloured characters and animals. */
export function partMaterial(): THREE.MeshStandardMaterial {
  return cachedMaterial('part-vc', () =>
    new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.72 }),
  );
}
