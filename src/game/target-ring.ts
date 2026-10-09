import * as THREE from 'three';
import { cachedGeometry, cachedMaterial } from '../core/cache';

/** Pulsing mint ring on the floor under the current interaction target. */
export class TargetRing {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private time = 0;

  constructor() {
    const geo = cachedGeometry('target-ring', () => new THREE.RingGeometry(0.42, 0.52, 40).rotateX(-Math.PI / 2));
    this.mat = cachedMaterial('target-ring', () =>
      new THREE.MeshBasicMaterial({ color: '#4fd1b0', transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.y = 0.02;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  update(dt: number, target: THREE.Vector3 | null, radius = 0.4): void {
    this.time += dt;
    if (!target) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.mesh.position.x = target.x;
    this.mesh.position.z = target.z;
    const s = (radius / 0.4) * (1 + Math.sin(this.time * 6) * 0.06);
    this.mesh.scale.set(s, 1, s);
    this.mat.opacity = 0.6 + Math.sin(this.time * 6) * 0.2;
  }
}
