import * as THREE from 'three';
import { cachedGeometry, cachedMaterial } from '../core/cache';
import { blobShadowTexture } from './canvas-art';

/** Flat soft shadow decal; cheap stand-in for real shadows on small objects. */
export function blobShadow(width: number, depth = width, opacity = 1): THREE.Mesh {
  const geo = cachedGeometry('blob-plane', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const mat = cachedMaterial(`blob:${opacity}`, () =>
    new THREE.MeshBasicMaterial({
      map: blobShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(width, 1, depth);
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}
