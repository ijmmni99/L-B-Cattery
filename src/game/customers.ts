import * as THREE from 'three';
import { CUSTOMERS } from '../config/customers';
import { DEFAULT_PRICE } from '../config/products';
import { PRICE_LIMIT, PRICE_OK, XP_ADOPTION, xpForSale } from '../config/progression';
import { haptic } from '../core/haptics';
import { NavGrid } from '../core/nav';
import type { CheckoutCounter } from '../world/counter';
import type { CollisionWorld } from '../world/colliders';
import { DOOR_INSIDE, DOOR_OUTSIDE, QUEUE, STORE } from '../world/layout';
import { toast } from '../ui/toast';
import { MESS } from '../config/care';
import { Customer } from './customer';
import type { MessSystem } from './mess';
import type { InfoCardData, Interactable, InteractionSystem } from './interactions';
import type { ShelfManager } from './shelves';
import { addMoney, addXp, dayStats } from './state';
import { VillaManager } from './villas';

const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const V = new THREE.Vector3();
const ANCHOR = new THREE.Vector3();
const YIELD_DIST = 0.7;

export interface ShopStats {
  served: number;
  walkouts: number;
  tooExpensive: number;
  adopted: number;
  earned: number;
}

/**
 * Spawns shoppers, sends them to stocked shelves, queues them at the counter
 * and lets the player check them out.
 */
export class CustomerSystem {
  readonly stats: ShopStats = { served: 0, walkouts: 0, earned: 0, tooExpensive: 0, adopted: 0 };
  private readonly customers: Customer[] = [];
  private readonly queue: Customer[] = [];
  private spawnTimer: number = CUSTOMERS.firstDelay;
  readonly nav: NavGrid;
  /** Opening hours (set by the day cycle): no new customers while closed; `rush` scales arrivals. */
  schedule: { isOpen(): boolean; rush(): number } | null = null;
  /** Set by the checkout panel; called when the player starts serving the first customer. */
  onCheckout: ((c: Customer) => void) | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly shelves: ShelfManager,
    interactions: InteractionSystem,
    counter: CheckoutCounter,
    colliders: CollisionWorld,
    private readonly playerPos: THREE.Vector3,
    private readonly villas: VillaManager | null = null,
    private readonly mess: MessSystem | null = null,
    /** 0..1; a dirty shop gets fewer visitors. */
    private readonly cleanliness: () => number = () => 1,
  ) {
    this.nav = new NavGrid(colliders, STORE.minX, STORE.minZ, STORE.maxX, STORE.maxZ);
    const item: Interactable = {
      position: counter.group.position,
      object: counter.register,
      highlight: counter.register,
      label: () => {
        const c = this.head();
        return c ? 'Serve customer' : null;
      },
      act: () => this.beginCheckout(),
      info: () => this.infoFor(),
    };
    interactions.add(item);
  }

  /** True if any customer is within `r` metres of (x, z). */
  anyNear(x: number, z: number, r: number): boolean {
    return this.customers.some((c) => Math.hypot(c.position.x - x, c.position.z - z) < r);
  }

  /** End of day: everyone is gone at once (reservations released). */
  clearAll(): void {
    for (const c of this.customers) {
      for (const w of c.wishes) if (w.kind === 'villa') w.villa.reserved = false;
      for (const l of c.basket) if (l.villa) l.villa.reserved = false;
      this.scene.remove(c.root, c.bubble.sprite);
    }
    this.customers.length = 0;
    this.queue.length = 0;
  }

  get inStore(): number {
    return this.customers.length;
  }

  get waiting(): number {
    return this.queue.length;
  }

  update(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = rand(CUSTOMERS.spawnMin, CUSTOMERS.spawnMax) / ((0.4 + 0.6 * this.cleanliness()) * (this.schedule?.rush() ?? 1));
      if ((this.schedule?.isOpen() ?? true) && this.customers.length < CUSTOMERS.maxInStore && (this.shelves.stockedSlots().length > 0 || (this.villas?.adoptable().length ?? 0) > 0)) this.spawn();
    }

    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      c.update(dt, ANCHOR);
      this.yieldTo(c, dt);
      this.think(c, dt);
      this.maybeLitter(c, dt);
      if (c.stage === 'leaving' && c.idle) {
        this.scene.remove(c.root, c.bubble.sprite);
        this.customers.splice(i, 1);
      }
    }
    this.layoutQueue();
  }

  // ----------------------------------------------------------------- behaviour

  /** Shoppers occasionally drop some litter while walking around. */
  private maybeLitter(c: Customer, dt: number): void {
    if (!this.mess || c.stage === 'leaving' || c.position.x < STORE.minX + 1.2) return;
    c.messTimer -= dt;
    if (c.messTimer > 0) return;
    c.messTimer = rand(MESS.dropMin, MESS.dropMax);
    if (c.moving) this.mess.drop(c.position.x, c.position.z);
  }

  private spawn(): void {
    const slots = this.shelves.stockedSlots();
    // Shuffle, then take 1-3 distinct slots to visit.
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const c = new Customer(V.set(DOOR_OUTSIDE.x, 0, DOOR_OUTSIDE.z), this.nav);
    const n = Math.min(slots.length, CUSTOMERS.minWishes + Math.floor(Math.random() * (CUSTOMERS.maxWishes - CUSTOMERS.minWishes + 1)));
    for (const slot of slots.slice(0, n)) {
      const cheap = (slot.def?.price ?? 99) <= 5;
      c.wishes.push({ kind: 'shelf', slot, qty: 1 + Math.floor(Math.random() * (cheap ? 3 : 2)) });
    }
    // Some visitors come to adopt: they reserve one available cat.
    const free = this.villas?.adoptable() ?? [];
    if (free.length > 0 && (slots.length === 0 || Math.random() < CUSTOMERS.adoptChance)) {
      const villa = free[Math.floor(Math.random() * free.length)];
      villa.reserved = true;
      c.wishes.unshift({ kind: 'villa', villa });
    }
    if (c.wishes.length === 0) return;
    c.walkRaw([DOOR_INSIDE]);
    this.scene.add(c.root, c.bubble.sprite);
    this.customers.push(c);
  }

  private think(c: Customer, dt: number): void {
    switch (c.stage) {
      case 'shop': {
        if (!c.idle) return;
        // Drop wishes whose shelf or villa was removed in build mode.
        while (c.wishes[0] && (c.wishes[0].kind === 'villa' ? c.wishes[0].villa.removed : c.wishes[0].slot.unit.removed)) c.wishes.shift();
        const wish = c.wishes[0];
        if (!wish) {
          this.finishShopping(c);
          return;
        }
        let face: number;
        if (wish.kind === 'villa') {
          wish.villa.standPoint(V);
          face = Math.atan2(wish.villa.spot.x - V.x, wish.villa.spot.z - V.z);
        } else {
          this.shelves.standPoint(wish.slot, V);
          face = Math.atan2(wish.slot.proxy.position.x - V.x, wish.slot.proxy.position.z - V.z);
        }
        c.goTo(V.x, V.z, face);
        c.stage = 'browse';
        return;
      }
      case 'browse':
        if (!c.idle) return;
        c.pause(rand(CUSTOMERS.browseMin, CUSTOMERS.browseMax));
        c.character.reach = 1;
        c.stage = 'pick';
        return;
      case 'pick': {
        if (!c.idle) return;
        c.character.reach = 0;
        const wish = c.wishes.shift();
        if (wish?.kind === 'villa') {
          const cat = wish.villa.removed ? null : wish.villa.cat;
          if (cat) {
            c.addAdoption(wish.villa, cat.data.name, VillaManager.adoptionFee(wish.villa));
            cat.meow();
          } else {
            wish.villa.reserved = false;
          }
        } else if (wish?.slot.def && !wish.slot.unit.removed) {
          const def = wish.slot.def;
          const ratio = def.price / (DEFAULT_PRICE[def.id] ?? def.price);
          const chance = ratio <= PRICE_OK ? 1 : Math.max(0, 1 - (ratio - PRICE_OK) / (PRICE_LIMIT - PRICE_OK));
          if (Math.random() > chance) {
            c.bubble.show('💸');
            this.stats.tooExpensive++;
          } else {
            // Bargains make people grab one more.
            const qty = wish.qty + (ratio < 0.85 ? 1 : 0);
            const got = this.shelves.sell(wish.slot, qty);
            if (got > 0) {
              c.add(def, got);
              haptic(4);
            }
          }
        }
        c.stage = 'shop';
        return;
      }
      case 'queue':
        if (c.idle && this.queue[0] === c) {
          c.stage = 'waiting';
          c.turnToward(0);
        }
        return;
      case 'waiting': {
        if (this.queue[0] !== c) {
          c.stage = 'queue';
          return;
        }
        c.patience -= dt;
        const impatient = c.patience < CUSTOMERS.impatientBelow;
        c.mood(dt, impatient ? '😠' : '💲');
        if (c.patience <= 0) this.walkOut(c);
        return;
      }
      default:
        return; // 'paying' / 'leaving' need no thinking
    }
  }

  private finishShopping(c: Customer): void {
    if (c.itemCount === 0) {
      c.bubble.show('😕');
      this.leave(c);
      return;
    }
    c.stage = 'queue';
    this.queue.push(c);
  }

  private layoutQueue(): void {
    this.queue.forEach((c, k) => {
      if (c.spotIndex === k) return;
      c.spotIndex = k;
      c.goTo(QUEUE.x - k * QUEUE.step, QUEUE.z, 0);
      if (c.stage === 'waiting') c.stage = 'queue';
    });
  }

  private leave(c: Customer): void {
    for (const w of c.wishes) if (w.kind === 'villa') w.villa.reserved = false;
    for (const l of c.basket) if (l.villa && !c.sold) l.villa.reserved = false;
    c.stage = 'leaving';
    c.spotIndex = -1;
    c.goTo(DOOR_INSIDE.x, DOOR_INSIDE.z, null, [DOOR_OUTSIDE]);
  }

  private walkOut(c: Customer): void {
    this.queue.splice(this.queue.indexOf(c), 1);
    this.stats.walkouts++;
    dayStats.walkouts++;
    c.bubble.show('😠');
    toast('A customer got tired of waiting and left', 'bad');
    this.leave(c);
  }

  // ------------------------------------------------------------------ checkout

  head(): Customer | null {
    const c = this.queue[0];
    return c && c.stage === 'waiting' ? c : null;
  }

  private beginCheckout(): void {
    const c = this.head();
    if (!c) return;
    c.stage = 'paying';
    this.onCheckout?.(c);
  }

  /** Player closed the register without finishing: the customer keeps waiting. */
  cancelCheckout(c: Customer): void {
    if (c.stage === 'paying') c.stage = 'waiting';
  }

  /** Sale done. `extra` = tip (+) or change overpaid (-). */
  completeCheckout(c: Customer, extra: number): void {
    const gain = Math.round((c.total + extra) * 100) / 100;
    addMoney(gain);
    dayStats.revenue += gain;
    dayStats.served++;
    this.stats.served++;
    this.stats.earned += gain;
    for (const l of c.basket) {
      if (l.villa) {
        this.villas?.releaseCat(l.villa);
        this.stats.adopted++;
        dayStats.adopted++;
        addXp(XP_ADOPTION);
      }
    }
    c.sold = true;
    addXp(xpForSale(gain));
    const q = this.queue.indexOf(c);
    if (q >= 0) this.queue.splice(q, 1);
    c.bubble.show(extra > 0 ? '😍' : '😊');
    toast(`+$${gain.toFixed(2)}${extra > 0 ? ` (tip $${extra})` : ''}`, 'good');
    haptic([12, 30, 16]);
    this.leave(c);
  }

  /** Walking customers step around the player and each other instead of through them. */
  private yieldTo(c: Customer, dt: number): void {
    if (!c.moving) return;
    const give = (ox: number, oz: number): void => {
      const dx = c.position.x - ox;
      const dz = c.position.z - oz;
      const d = Math.hypot(dx, dz);
      if (d >= YIELD_DIST || d < 1e-4) return;
      const push = (YIELD_DIST - d) * Math.min(1, dt * 6);
      c.push((dx / d) * push, (dz / d) * push);
    };
    give(this.playerPos.x, this.playerPos.z);
    for (const o of this.customers) if (o !== c) give(o.position.x, o.position.z);
  }

  private infoFor(): InfoCardData | null {
    const c = this.head();
    if (!c) return null;
    const mood = c.patience < CUSTOMERS.impatientBelow ? '😠 Impatient' : '😊 Happy';
    return {
      key: `cust:${c.itemCount}:${c.total}:${mood}`,
      title: 'Customer at the register',
      sub: c.basket.map((l) => (l.qty > 1 ? `${l.qty}× ${l.name}` : l.name)).join(', '),
      tag: mood,
    };
  }
}
