import * as THREE from 'three';
import { CUSTOMERS, KINDS, type CustomerKind } from '../config/customers';
import type { ProductDef } from '../config/products';
import { cachedGeometry, mesh, pastel, roundedBox } from '../core/cache';
import type { ShelfSlot } from './shelves';
import type { Villa } from './villas';
import type { NavGrid } from '../core/nav';
import { randomCharacterParams, type CharacterParams } from '../models/character-builder';
import { NavWalker } from './nav-walker';

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

function basketMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(roundedBox(0.34, 0.16, 0.24, 0.04), pastel('#ff8fab', 0.6));
  const handle = mesh(cachedGeometry('basket-handle', () => new THREE.TorusGeometry(0.1, 0.012, 6, 14, Math.PI)), pastel('#ffffff', 0.5), { cast: false });
  handle.position.y = 0.08;
  g.add(body, handle);
  return g;
}

/** A shopper: a nav walker with a basket, a shopping list and register state. */
export class Customer extends NavWalker {
  readonly basket: BasketLine[] = [];
  stage: CustomerStage = 'shop';
  kind: CustomerKind = 'regular';
  /** Emoji floating over the head while shopping (VIP crown, kid teddy, ...). */
  badge: string | null = null;
  /** Multiplier on shelf prices and adoption fees. */
  priceMult = 1;
  /** What a picky adopter is after, shown on the register card. */
  wantText: string | null = null;
  /** Remaining slots to visit. */
  wishes: Wish[] = [];
  spotIndex = -1;
  patience: number = CUSTOMERS.patience;
  /** Units scanned so far at the register, per product id. */
  readonly scanned = new Map<string, number>();
  payment: { method: 'cash' | 'card'; tender: number } | null = null;
  /** Set once the sale is rung up. */
  sold = false;
  /** Seconds until this customer might drop some litter. */
  messTimer = 20 + Math.random() * 30;
  private readonly basketMesh = basketMesh();

  constructor(start: THREE.Vector3, nav: NavGrid) {
    super(start, nav, lookFor(lookCounter++), CUSTOMERS.walkSpeed * (0.8 + Math.random() * 0.35));
    this.character.carryAnchor.add(this.basketMesh);
    this.basketMesh.visible = false;
  }

  /** Turns this shopper into a VIP, kid or picky adopter. */
  setKind(kind: CustomerKind): void {
    this.kind = kind;
    if (kind === 'regular') return;
    const k = KINDS[kind];
    this.badge = k.badge;
    this.priceMult = k.priceMult;
    this.patience = k.patience;
    if (kind === 'kid') {
      this.cruise *= KINDS.kid.speedMult;
      this.root.scale.multiplyScalar(KINDS.kid.scale);
    }
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
    else this.basket.push({ id: def.id, name: def.name, icon: def.icon, color: def.color, price: Math.round(def.price * this.priceMult * 100) / 100, qty });
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
}
