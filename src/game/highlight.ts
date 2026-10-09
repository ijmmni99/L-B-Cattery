import * as THREE from 'three';

/**
 * Soft mint outline around the targeted object: an inverted-hull shell
 * (back faces pushed out along normals) added under each of its meshes.
 * Shared materials stay untouched.
 */
export class Highlighter {
  private target: THREE.Object3D | null = null;
  private readonly shells: THREE.Mesh[] = [];
  private readonly material: THREE.MeshBasicMaterial;
  private time = 0;

  constructor(thickness = 0.022) {
    this.material = new THREE.MeshBasicMaterial({
      color: '#5fe0c0',
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed += normalize(normal) * ${thickness.toFixed(4)};`,
      );
    };
  }

  setTarget(obj: THREE.Object3D | null): void {
    if (obj === this.target) return;
    for (const s of this.shells) s.removeFromParent();
    this.shells.length = 0;
    this.target = obj;
    if (!obj) return;
    const meshes: THREE.Mesh[] = [];
    obj.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.isOutline) meshes.push(o);
    });
    for (const m of meshes) {
      const shell = new THREE.Mesh(m.geometry, this.material);
      shell.userData.isOutline = true;
      shell.raycast = () => {}; // never steal the centre ray
      shell.renderOrder = 3;
      m.add(shell);
      this.shells.push(shell);
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.material.opacity = 0.6 + Math.sin(this.time * 5) * 0.25;
  }
}
