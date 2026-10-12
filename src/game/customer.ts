import * as THREE from 'three';
import { CUSTOMERS } from '../config/customers';
import type { ProductDef } from '../config/products';
import { cachedGeometry, mesh, pastel, roundedBox } from '../core/cache';
import type { ShelfSlot } from './shelves';
import type { Villa } from './villas';
import type { NavGrid } from '../core/nav';
import { MeowBubble } from '../models/cat/meow-bubble';
import { Character, randomCharacterParams, type CharacterParams } from '../models/character-builder';

export type CustomerStage = 'shop' | 'browse' | 'pick' | 'queue' | 'waiting' | 'paying' | 'leaving';

export interface BasketLine {
  id: string;
  name: string;
  icon: string;
  color: string;
  price: number;
  qty: number;
  /** Set for an adoption: the villa whose cat is being bought. */
  villa?: Villa;
}

export type Wish = { kind: 'shelf'; slot: ShelfSlot; qty: number } | { kind: 'villa'; villa: Villa };

/** Few shared looks so cached character geometry stays bounded. */
const LOOKS: CharacterParams[] = [];
function lookFor(i: number): CharacterParams {
  while (LOOKS.length < 12) LOOKS.push(randomCharacterParams());
  return LOOKS[i % LOOKS.length];
}
let lookCounter = Math.floor(Math.random() * 12);

const TURN_RATE = 6;
const ACCEL = 2.6;
const tmp = new THREE.Vector3();

function basketMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(roundedBox(0.34, 0.16, 0.24, 0.04), pastel('#ff8fab', 0.6));
  const handle = mesh(cachedGeometry('basket-handle', () => new THREE.TorusGeometry(0.1, 0.012, 6, 14, Math.PI)), pastel('#ffffff', 0.5), { cast: false });
  handle.position.y = 0.08;
  g.add(body, handle);
  return g;
}

/** A walking shopper: smooth path-following character with a basket and a mood bubble. */
export class Customer {
  readonly character: Character;
  readonly root: THREE.Group;
  readonly bubble = new MeowBubble();
  readonly basket: BasketLine[] = [];
  readonly position = new THREE.Vector3();
  stage: CustomerStage = 'shop';
  /** Remaining slots to visit. */
  wishes: Wish[] = [];
  spotIndex = -1;
  patience: number = CUSTOMERS.patience;
  /** Units scanned so far at the register, per product id. */
  readonly scanned = new Map<string, number>();
  payment: { method: 'cash' | 'card'; tender: number } | null = null;
  /** Set once the sale is rung up. */
  sold = false;
  speed = 0;
  private readonly cruise = CUSTOMERS.walkSpeed * (0.8 + Math.random() * 0.35);
  private route: THREE.Vector3[] = [];
  private faceYaw: number | null = null;
  private wait = 0;
  private yaw = 0;
  private bubbleTimer = 2;
  private readonly basketMesh = basketMesh();

  constructor(start: THREE.Vector3, private readonly nav: NavGrid) {
    this.character = new Character(lookFor(lookCounter++));
    this.character.gait = 2.4;
    this.root = this.character.root;
    this.position.copy(start);
    this.root.position.copy(start);
    this.yaw = Math.PI / 2;
    this.character.carryAnchor.add(this.basketMesh);
    this.basketMesh.visible = false;
  }

  get total(): number {
    let t = 0;
    for (const l of this.basket) t += l.price * l.qty;
    return Math.round(t * 100) / 100;
  }

  get itemCount(): number {
    return this.basket.reduce((n, l) => n + l.qty, 0);
  }

  get scannedCount(): number {
    let n = 0;
    for (const v of this.scanned.values()) n += v;
    return n;
  }

  add(def: ProductDef, qty: number): void {
    const line = this.basket.find((l) => l.id === def.id);
    if (line) line.qty += qty;
    else this.basket.push({ id: def.id, name: def.name, icon: def.icon, color: def.color, price: def.price, qty });
    this.holdBasket();
  }

  addAdoption(villa: Villa, name: string, fee: number): void {
    this.basket.push({ id: `cat:${name}`, name: `Adopt ${name}`, icon: '🐱', color: '#ffd1dc', price: fee, qty: 1, villa });
    this.holdBasket();
  }

  private holdBasket(): void {
    this.character.carrying = true;
    this.basketMesh.visible = true;
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

  /** Nudge sideways (used to yield to others); ignored while standing. */
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
