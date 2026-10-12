import * as THREE from 'three';
import type { NavGrid } from '../core/nav';
import { MeowBubble } from '../models/cat/meow-bubble';
import { Character, type CharacterParams } from '../models/character-builder';

const TURN_RATE = 6;
const ACCEL = 2.6;
const tmp = new THREE.Vector3();

/** A person who follows nav paths smoothly (shared by customers and staff). */
export class NavWalker {
  readonly character: Character;
  readonly root: THREE.Group;
  readonly bubble = new MeowBubble();
  readonly position = new THREE.Vector3();
  speed = 0;
  protected cruise: number;
  private route: THREE.Vector3[] = [];
  private faceYaw: number | null = null;
  private wait = 0;
  private yaw = 0;
  private bubbleTimer = 2;

  constructor(start: THREE.Vector3, protected readonly nav: NavGrid, look: CharacterParams, cruise: number) {
    this.character = new Character(look);
    this.character.gait = 2.4;
    this.cruise = cruise;
    this.root = this.character.root;
    this.position.copy(start);
    this.root.position.copy(start);
    this.yaw = Math.PI / 2;
  }

  /** Walk to (x, z) around obstacles, optionally via raw points past the door, then face `face`. */
  goTo(x: number, z: number, face: number | null = null, raw: Array<{ x: number; z: number }> = []): void {
    const path = this.nav.findPath({ x: this.position.x, z: this.position.z }, { x, z });
    this.route = [...path, ...raw].map((p) => new THREE.Vector3(p.x, 0, p.z));
    this.faceYaw = face;
  }

  /** Straight walk (no nav), used on the pavement outside the shop. */
  walkRaw(points: Array<{ x: number; z: number }>): void {
    this.route = points.map((p) => new THREE.Vector3(p.x, 0, p.z));
    this.faceYaw = null;
  }

  pause(seconds: number): void {
    this.wait = seconds;
  }

  /** True when there is nothing left to walk or wait for. */
  get idle(): boolean {
    return this.route.length === 0 && this.wait <= 0 && this.speed < 0.05;
  }

  get moving(): boolean {
    return this.route.length > 0;
  }

  turnToward(yaw: number): void {
    this.faceYaw = yaw;
  }

  /** Nudge sideways (used to yield to others). */
  push(x: number, z: number): void {
    this.position.x += x;
    this.position.z += z;
  }

  update(dt: number, anchor: THREE.Vector3): void {
    if (this.wait > 0) this.wait -= dt;
    let desired = 0;
    const next = this.route[0];
    if (next) {
      tmp.subVectors(next, this.position);
      tmp.y = 0;
      const dist = tmp.length();
      const last = this.route.length === 1;
      if (dist < (last ? 0.05 : 0.22)) {
        this.route.shift();
        if (last) this.position.copy(next);
      } else {
        const want = Math.atan2(tmp.x, tmp.z);
        this.turn(want, dt);
        let diff = want - this.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        // Slow for tight turns and ease into the final stop.
        const align = Math.max(0, Math.cos(diff));
        desired = this.cruise * (0.25 + 0.75 * align * align);
        if (last) desired = Math.min(desired, 0.3 + dist * 1.6);
      }
    } else if (this.faceYaw !== null) {
      this.turn(this.faceYaw, dt);
    }
    // Accelerate toward the desired speed rather than snapping to it.
    const dv = desired - this.speed;
    this.speed += Math.sign(dv) * Math.min(Math.abs(dv), ACCEL * dt);
    if (this.speed > 0.01) {
      this.position.x += Math.sin(this.yaw) * this.speed * dt;
      this.position.z += Math.cos(this.yaw) * this.speed * dt;
    }
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;

    this.character.animate(dt, this.speed);
    anchor.set(this.position.x, 2.0, this.position.z);
    this.bubble.update(dt, anchor);
  }

  /** Pop a mood bubble every few seconds while `text` is set. */
  mood(dt: number, text: string | null): void {
    if (!text) return;
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
      this.bubble.show(text);
      this.bubbleTimer = 4;
    }
  }

  private turn(target: number, dt: number): void {
    let diff = target - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.yaw += diff * Math.min(1, dt * TURN_RATE);
  }
}
