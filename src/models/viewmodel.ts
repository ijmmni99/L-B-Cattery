import * as THREE from 'three';
import { VIEWMODEL_FOV } from '../core/renderer';
import { shapes } from './character-parts';
import { PartBuilder, partMaterial } from './part-builder';

const SKIN = '#f6caa6';
const SLEEVE = '#7fcfb8';
const CUFF = '#ffffff';

/** One forearm + mitten hand. Origin = palm centre; forearm runs down -Y. */
function buildArmGeometry(side: 1 | -1): THREE.BufferGeometry {
  const b = new PartBuilder();
  b.add(shapes.sphere(), SKIN, [0, 0, 0], [0, 0, 0], [0.05, 0.068, 0.032]);
  b.add(shapes.capsule(0.017, 0.035), SKIN, [side * -0.047, -0.012, 0.012], [0, 0, side * 0.55]);
  b.add(shapes.capsule(0.036, 0.13), SKIN, [0, -0.13, 0]);
  b.add(shapes.cylinder(0.046, 0.046, 0.03), CUFF, [0, -0.22, 0]);
  b.add(shapes.capsule(0.05, 0.12), SLEEVE, [0, -0.32, 0]);
  return b.build();
}

interface HandPose {
  pos: THREE.Vector3;
  rot: THREE.Euler;
}

/**
 * First-person hands and held item, rendered as an overlay layer (own scene
 * and camera) so they never clip into the world. Placement is relative to
 * the view frustum so it works in landscape and portrait.
 */
export class ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(VIEWMODEL_FOV, 1, 0.01, 10);
  /** Parent for carried objects (box centre). */
  readonly carryAnchor = new THREE.Group();
  carrying = false;

  private readonly rig = new THREE.Group();
  private readonly hands: [THREE.Mesh, THREE.Mesh];
  private carryBlend = 0;
  private time = 0;
  private phase = 0;
  private walk = 0;
  private swayX = 0;
  private swayY = 0;
  private readonly idle: [HandPose, HandPose] = [this.pose(), this.pose()];
  private readonly hold: [HandPose, HandPose] = [this.pose(), this.pose()];

  constructor() {
    this.scene.add(new THREE.HemisphereLight('#fff8ee', '#d9c2a2', 1.7));
    const key = new THREE.DirectionalLight('#fff1dc', 1.6);
    key.position.set(-1, 2, 1.5);
    this.scene.add(key);
    this.scene.add(this.camera);
    this.camera.add(this.rig);

    const mat = partMaterial();
    this.hands = [new THREE.Mesh(buildArmGeometry(-1), mat), new THREE.Mesh(buildArmGeometry(1), mat)];
    this.rig.add(this.hands[0], this.hands[1], this.carryAnchor);
  }

  private pose(): HandPose {
    return { pos: new THREE.Vector3(), rot: new THREE.Euler() };
  }

  /** Recompute rest poses from the current frustum (call after resize). */
  layout(): void {
    const halfAt = (d: number): [number, number] => {
      const hh = d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      return [hh * this.camera.aspect, hh];
    };
    // Idle: hands peek in from the bottom corners.
    const d = 0.5;
    const [hw, hh] = halfAt(d);
    const x = Math.min(0.3, hw * 0.62);
    for (const [i, s] of [[0, -1], [1, 1]] as const) {
      this.idle[i].pos.set(s * x, -hh * 0.86, -d);
      this.idle[i].rot.set(-1.12, s * -0.25, s * -0.18);
    }
    // Holding: box centred low, hands gripping its sides.
    const bd = 1.05;
    const [, bh] = halfAt(bd);
    this.carryAnchor.position.set(0, -bh * 0.74, -bd);
    this.carryAnchor.rotation.set(0.12, 0, 0);
    for (const [i, s] of [[0, -1], [1, 1]] as const) {
      this.hold[i].pos.set(s * 0.27, -bh * 0.74 - 0.05, -bd + 0.08);
      this.hold[i].rot.set(-0.5, 0, s * 0.95);
    }
  }

  /**
   * @param speed ground speed (m/s) for walk sway
   * @param lookDx yaw change this frame (radians), lookDy pitch change
   */
  update(dt: number, speed: number, lookDx: number, lookDy: number): void {
    this.time += dt;
    this.carryBlend += ((this.carrying ? 1 : 0) - this.carryBlend) * Math.min(dt * 9, 1);
    const moving = Math.min(speed / 3, 1);
    this.walk += (moving - this.walk) * Math.min(dt * 8, 1);
    this.phase += dt * (5 + speed * 1.8);

    // Look sway lags behind the camera, springing back to centre.
    const k = Math.min(dt * 10, 1);
    this.swayX += (THREE.MathUtils.clamp(lookDx * 1.2, -0.05, 0.05) - this.swayX) * k;
    this.swayY += (THREE.MathUtils.clamp(-lookDy * 1.2, -0.04, 0.04) - this.swayY) * k;

    const bobX = Math.sin(this.phase) * 0.012 * this.walk;
    const bobY = Math.abs(Math.cos(this.phase)) * 0.016 * this.walk + Math.sin(this.time * 1.7) * 0.004;
    this.rig.position.set(this.swayX + bobX, this.swayY - bobY, 0);
    this.rig.rotation.z = -this.swayX * 0.6;

    const t = this.carryBlend;
    for (let i = 0; i < 2; i++) {
      const h = this.hands[i];
      const a = this.idle[i];
      const b = this.hold[i];
      h.position.lerpVectors(a.pos, b.pos, t);
      h.rotation.set(
        THREE.MathUtils.lerp(a.rot.x, b.rot.x, t),
        THREE.MathUtils.lerp(a.rot.y, b.rot.y, t),
        THREE.MathUtils.lerp(a.rot.z, b.rot.z, t),
      );
    }
  }
}
