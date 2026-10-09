import * as THREE from 'three';
import { mergeStatic } from '../core/merge-static';
import { buildDecor } from './decor';
import { buildLighting } from './lighting';
import { buildStorefront } from './storefront';
import { buildFloor, buildWalls } from './walls';

export interface StoreWorld {
  root: THREE.Group;
  update: (dt: number, t: number) => void;
}

/** Assembles the static store shell (M1). Gameplay objects attach later. */
export function buildStore(scene: THREE.Scene): StoreWorld {
  buildLighting(scene);
  const root = new THREE.Group();
  root.name = 'store';
  root.add(buildFloor(), buildWalls(), buildDecor());
  const front = buildStorefront();
  root.add(front.group);

  root.add(mergeStatic(root));
  // Static geometry never moves: skip per-frame matrix work.
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    o.matrixAutoUpdate = false;
  });
  scene.add(root);

  return {
    root,
    update: (_dt, t) => front.update(t),
  };
}
