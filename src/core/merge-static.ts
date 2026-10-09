import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Collapses every opaque, static mesh under `root` into one mesh per
 * material (world transforms baked in). Transparent meshes and anything
 * flagged `userData.dynamic` are left untouched. Cuts draw calls for the
 * store shell from ~100 to ~15.
 */
export function mergeStatic(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>();
  const remove: THREE.Mesh[] = [];

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material)) return;
    const mat = obj.material as THREE.Material;
    if (mat.transparent || obj.userData.dynamic || hasDynamicAncestor(obj, root)) return;
    const geo = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    geo.applyMatrix4(obj.matrixWorld);
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') geo.deleteAttribute(name);
    }
    let b = buckets.get(mat);
    if (!b) {
      b = { geos: [], cast: false, receive: false };
      buckets.set(mat, b);
    }
    b.geos.push(geo);
    b.cast ||= obj.castShadow;
    b.receive ||= obj.receiveShadow;
    remove.push(obj);
  });

  for (const m of remove) m.removeFromParent();

  const merged = new THREE.Group();
  merged.name = 'merged-static';
  for (const [mat, b] of buckets) {
    const geo = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!geo) {
      console.warn('mergeStatic: incompatible geometries for material', mat.name || mat.uuid);
      continue;
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    merged.add(mesh);
  }
  return merged;
}

function hasDynamicAncestor(obj: THREE.Object3D, root: THREE.Object3D): boolean {
  let p = obj.parent;
  while (p && p !== root) {
    if (p.userData.dynamic) return true;
    p = p.parent;
  }
  return false;
}
