import * as THREE from 'three';
import type { Input } from '../core/input';
import { Character, PLAYER_PARAMS } from '../models/character-builder';
import type { CollisionWorld } from '../world/colliders';

const MAX_SPEED = 4.2;
const ACCEL = 14;
const TURN_RATE = 12;
export const PLAYER_RADIUS = 0.32;

function angleLerp(a: number, b: number, t: number): number {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * t;
}

/** Player avatar: camera-relative movement, smooth turning, collisions. */
export class Player {
  readonly character = new Character(PLAYER_PARAMS);
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  facing = 0;
  carried: THREE.Object3D | null = null;
  private readonly desired = new THREE.Vector3();

  constructor(start: THREE.Vector3) {
    this.position = start.clone();
    this.character.root.position.copy(this.position);
  }

  get object(): THREE.Object3D {
    return this.character.root;
  }

  /** Camera looks toward -Z with fixed yaw, so screen-up = world -Z. */
  update(dt: number, input: Input, world: CollisionWorld): void {
    const slow = this.carried ? 0.85 : 1;
    this.desired.set(input.move.x, 0, -input.move.y).multiplyScalar(MAX_SPEED * slow);
    const k = 1 - Math.exp(-ACCEL * dt);
    this.velocity.lerp(this.desired, k);
    if (this.velocity.lengthSq() < 1e-4) this.velocity.set(0, 0, 0);

    const px = this.position.x;
    const pz = this.position.z;
    this.position.addScaledVector(this.velocity, dt);
    world.resolveCircle(this.position, PLAYER_RADIUS);

    // Animate from real movement so pushing into a wall doesn't moonwalk.
    const speed = dt > 0 ? Math.hypot(this.position.x - px, this.position.z - pz) / dt : 0;
    if (input.move.lengthSq() > 0.01) {
      const target = Math.atan2(input.move.x, -input.move.y);
      this.facing = angleLerp(this.facing, target, 1 - Math.exp(-TURN_RATE * dt));
    }

    const root = this.character.root;
    root.position.copy(this.position);
    root.rotation.y = this.facing;
    this.character.carrying = this.carried !== null;
    this.character.animate(dt, speed);
  }

  pickUp(obj: THREE.Object3D): void {
    this.carried = obj;
    obj.removeFromParent();
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    this.character.carryAnchor.add(obj);
  }

  /** Detaches the carried object and returns it (caller re-parents it). */
  drop(): THREE.Object3D | null {
    const obj = this.carried;
    if (!obj) return null;
    obj.removeFromParent();
    this.carried = null;
    return obj;
  }

  /** Point on the floor just in front of the player. */
  frontPoint(distance = 0.85): THREE.Vector3 {
    return new THREE.Vector3(
      this.position.x + Math.sin(this.facing) * distance,
      0,
      this.position.z + Math.cos(this.facing) * distance,
    );
  }
}
