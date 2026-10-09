import * as THREE from 'three';
import { STORE } from './layout';

/** One hemisphere + one shadow-casting sun, sized to cover the store. */
export function buildLighting(scene: THREE.Scene): THREE.DirectionalLight {
  scene.background = new THREE.Color('#bfe3ef');
  scene.fog = new THREE.Fog('#d4ecf2', 30, 70);

  scene.add(new THREE.HemisphereLight('#fff8ee', '#e6cfae', 1.45));

  const sun = new THREE.DirectionalLight('#fff1dc', 2.1);
  // From the street side, high and slightly in front: light pours in through the window.
  sun.position.set(-7, 14, 8);
  sun.target.position.set(0, 0, 0);
  const cam = sun.shadow.camera;
  const halfW = (STORE.maxX - STORE.minX) / 2 + 2;
  const halfD = (STORE.maxZ - STORE.minZ) / 2 + 2;
  const half = Math.max(halfW, halfD);
  cam.left = -half;
  cam.right = half;
  cam.top = half;
  cam.bottom = -half;
  cam.near = 1;
  cam.far = 40;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  return sun;
}
