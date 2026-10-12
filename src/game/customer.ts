import * as THREE from 'three';
import { CUSTOMERS } from '../config/customers';
import type { ProductDef } from '../config/products';
import { cachedGeometry, mesh, pastel, roundedBox } from '../core/cache';
import type { ShelfSlot } from './shelves';
import { MeowBubble } from '../models/cat/meow-bubble';
import { Character, randomCharacterParams, type CharacterParams } from '../models/character-builder';

export type CustomerStage = 'shop' | 'browse' | 'pick' | 'queue' | 'waiting' | 'leaving';

export interface BasketLine {
  def: ProductDef;
  qty: number;
}

/** Few shared looks so cached character geometry stays bounded. */
const LOOKS: CharacterParams[] = [];
function lookFor(i: number): CharacterParams {
  while (LOOKS.length < 12) LOOKS.push(randomCharacterParams());
  return LOOKS[i % LOOKS.length];
}
let lookCounter = Math.floor(Math.random() * 12);

const TURN_RATE = 8;
const tmp = new THREE.Vector3();

function basketMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(roundedBox(0.34, 0.16, 0.24, 0.04), pastel('#ff8fab', 0.6));
  const handle = mesh(cachedGeometry('basket-handle', () => new THREE.TorusGeometry(0.1, 0.012, 6, 14, Math.PI)), pastel('#ffffff', 0.5), { cast: false });
  handle.position.y = 0.08;
  g.add(body, handle);
  return g;
}

/** A walking shopper: route-following character with a shopping basket and a mood bubble. */
export class Customer {
  readonly character: Character;
  readonly root: THREE.Group;
  readonly bubble = new MeowBubble();
  readonly basket: BasketLine[] = [];
  readonly position = new THREE.Vector3();
  stage: CustomerStage = 'shop';
  /** Remaining slots to visit. */
  wishes: Array<{ slot: ShelfSlot; qty: number }> = [];
  spotIndex = -1;
  patience: number = CUSTOMERS.patience;
  speed = 0;
  private route: THREE.Vector3[] = [];
  private faceYaw: number | null = null;
  private wait = 0;
  private yaw = 0;
  private bubbleTimer = 2;
  private readonly basketMesh = basketMesh();

  constructor(start: THREE.Vector3) {
    this.character = new Character(lookFor(lookCounter++));
    this.root = this.character.root;
    this.position.copy(start);
    this.root.position.copy(start);
    this.character.carryAnchor.add(this.basketMesh);
    this.basketMesh.visible = false;
  }

  get total(): number {
    let t = 0;
    for (const l of this.basket) t += l.def.price * l.qty;
    return Math.round(t * 100) / 100;
  }

  get itemCount(): number {
    return this.basket.reduce((n, l) => n + l.qty, 0);
  }

  add(def: ProductDef, qty: number): void {
    const line = this.basket.find((l) => l.def.id === def.id);
    if (line) line.qty += qty;
    else this.basket.push({ def, qty });
    this.character.carrying = true;
    this.basketMesh.visible = true;
  }

  /** Replace the route; `face` = yaw to turn to on arrival. */
  walkTo(points: Array<{ x: number; z: number }>, face: number | null = null): void {
    this.route = points.map((p) => new THREE.Vector3(p.x, 0, p.z));
    this.faceYaw = face;
  }

  pause(seconds: number): void {
    this.wait = seconds;
  }

  /** True when there is nothing left to walk or wait for. */
  get idle(): boolean {
    return this.route.length === 0 && this.wait <= 0 && this.speed < 0.05;
  }

  turnToward(yaw: number): void {
    this.faceYaw = yaw;
  }

  update(dt: number, scene: { bubbleAnchor: THREE.Vector3 }): void {
    this.speed = 0;
    if (this.wait > 0) this.wait -= dt;
    const next = this.route[0];
    if (next) {
      tmp.subVectors(next, this.position);
      tmp.y = 0;
      const dist = tmp.length();
      const step = CUSTOMERS.walkSpeed * dt;
      if (dist <= step) {
        this.position.copy(next);
        this.route.shift();
      } else {
        tmp.multiplyScalar(1 / dist);
        this.position.addScaledVector(tmp, step);
        this.turn(Math.atan2(tmp.x, tmp.z), dt);
        this.speed = CUSTOMERS.walkSpeed;
      }
    } else if (this.faceYaw !== null) {
      this.turn(this.faceYaw, dt);
    }
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
    this.character.animate(dt, this.speed);

    scene.bubbleAnchor.set(this.position.x, 2.0, this.position.z);
    this.bubble.update(dt, scene.bubbleAnchor);
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
