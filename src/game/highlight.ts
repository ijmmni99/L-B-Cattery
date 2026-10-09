import * as THREE from 'three';

/**
 * Soft mint outline around the targeted object: an inverted-hull shell
 * (back faces pushed out along normals) added under each of its meshes.
 * Shared materials stay untouched.
 */
export class Highlighter {
  private target: THREE.Object3D | null = null;
  private readonly shells: THREE.Mesh[] = [];
  private readonly materials = new Map<number, THREE.MeshBasicMaterial>();
  private time = 0;

  constructor(private readonly defaultThickness = 0.022) {}

  /** One shell material per thickness (object space); set per object via userData.outline. */
  private materialFor(thickness: number): THREE.MeshBasicMaterial {
    let m = this.materials.get(thickness);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: '#5fe0c0', side: THREE.BackSide, transparent: true, opacity: 0.85, depthWrite: false });
      m.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\ntransformed += normalize(normal) * ${thickness.toFixed(4)};`,
        );
      };
      m.customProgramCacheKey = () => `outline-${thickness}`;
      this.materials.set(thickness, m);
    }
    return m;
  }

  setTarget(obj: THREE.Object3D | null): void {
    if (obj === this.target) return;
    for (const s of this.shells) s.removeFromParent();
    this.shells.length = 0;
    this.target = obj;
    if (!obj) return;
    const material = this.materialFor((obj.userData.outline as number | undefined) ?? this.defaultThickness);
    const meshes: THREE.Mesh[] = [];
    obj.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.isOutline) meshes.push(o);
    });
    for (const m of meshes) {
      let shell: THREE.Mesh;
      if (m instanceof THREE.SkinnedMesh) {
        // Skinned shell shares the skeleton so the outline follows the pose.
        const sk = new THREE.SkinnedMesh(m.geometry, material);
        sk.bind(m.skeleton, m.bindMatrix);
        sk.frustumCulled = false;
        shell = sk;
      } else {
        shell = new THREE.Mesh(m.geometry, material);
      }
      shell.userData.isOutline = true;
      shell.raycast = () => {}; // never steal the centre ray
      shell.renderOrder = 3;
      m.add(shell);
      this.shells.push(shell);
    }
  }

  update(dt: number): void {
    this.time += dt;
    const o = 0.6 + Math.sin(this.time * 5) * 0.25;
    for (const m of this.materials.values()) m.opacity = o;
  }
}
