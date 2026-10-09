import * as THREE from 'three';
import type { Input } from '../core/input';
import type { FirstPersonCamera } from '../core/fp-camera';
import type { CollisionWorld } from '../world/colliders';

const MAX_SPEED = 3.4;
const ACCEL = 12;
export const PLAYER_RADIUS = 0.32;

/** First-person player: yaw-relative movement, collisions, carrying. */
export class Player {
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  carried: THREE.Object3D | null = null;
  /** Actual ground speed this frame (m/s). */
  speed = 0;
  private readonly desired = new THREE.Vector3();

  /**
   * @param holdAnchor where carried objects attach (the viewmodel's hands),
   *   rendered as an overlay so held items never clip into walls.
   */
  constructor(
    start: THREE.Vector3,
    readonly view: FirstPersonCamera,
    private readonly holdAnchor: THREE.Object3D,
  ) {
    this.position = start.clone();
  }

  get yaw(): number {
    return this.view.yaw;
  }

  update(dt: number, input: Input, world: CollisionWorld): void {
    const slow = this.carried ? 0.85 : 1;
    const yaw = this.view.yaw;
    // Forward (-Z at yaw 0) and right vectors on the floor plane.
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const mx = input.move.x;
    const my = input.move.y;
    this.desired.set(rx * mx + fx * my, 0, rz * mx + fz * my).multiplyScalar(MAX_SPEED * slow);

    const k = 1 - Math.exp(-ACCEL * dt);
    this.velocity.lerp(this.desired, k);
    if (this.velocity.lengthSq() < 1e-4) this.velocity.set(0, 0, 0);

    const px = this.position.x;
    const pz = this.position.z;
    this.position.addScaledVector(this.velocity, dt);
    world.resolveCircle(this.position, PLAYER_RADIUS);
    this.speed = dt > 0 ? Math.hypot(this.position.x - px, this.position.z - pz) / dt : 0;

    this.view.update(dt, this.position, this.speed);
  }

  pickUp(obj: THREE.Object3D): void {
    this.carried = obj;
    obj.removeFromParent();
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    this.holdAnchor.add(obj);
  }

  /** Detaches the carried object and returns it (caller re-parents it). */
  drop(): THREE.Object3D | null {
    const obj = this.carried;
    if (!obj) return null;
    obj.removeFromParent();
    this.carried = null;
    return obj;
  }
}
