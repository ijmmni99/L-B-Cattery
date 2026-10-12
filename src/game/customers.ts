import * as THREE from 'three';
import { CUSTOMERS } from '../config/customers';
import { haptic } from '../core/haptics';
import type { CheckoutCounter } from '../world/counter';
import { DOOR_INSIDE, DOOR_OUTSIDE, QUEUE } from '../world/layout';
import { toast } from '../ui/toast';
import { Customer } from './customer';
import type { InfoCardData, Interactable, InteractionSystem } from './interactions';
import type { ShelfManager } from './shelves';
import { addMoney } from './state';

const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const V = new THREE.Vector3();
const ANCHOR = { bubbleAnchor: new THREE.Vector3() };

export interface ShopStats {
  served: number;
  walkouts: number;
  earned: number;
}

/**
 * Spawns shoppers, sends them to stocked shelves, queues them at the counter
 * and lets the player check them out.
 */
export class CustomerSystem {
  readonly stats: ShopStats = { served: 0, walkouts: 0, earned: 0 };
  private readonly customers: Customer[] = [];
  private readonly queue: Customer[] = [];
  private spawnTimer: number = CUSTOMERS.firstDelay;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly shelves: ShelfManager,
    interactions: InteractionSystem,
    counter: CheckoutCounter,
  ) {
    const item: Interactable = {
      position: counter.group.position,
      object: counter.register,
      highlight: counter.register,
      label: () => {
        const c = this.head();
        return c ? `Checkout · $${c.total.toFixed(2)}` : null;
      },
      act: () => this.checkout(),
      info: () => this.infoFor(),
    };
    interactions.add(item);
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
      this.spawnTimer = rand(CUSTOMERS.spawnMin, CUSTOMERS.spawnMax);
      if (this.customers.length < CUSTOMERS.maxInStore && this.shelves.stockedSlots().length > 0) this.spawn();
    }

    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      c.update(dt, ANCHOR);
      this.think(c, dt);
      if (c.stage === 'leaving' && c.idle) {
        this.scene.remove(c.root, c.bubble.sprite);
        this.customers.splice(i, 1);
      }
    }
    this.layoutQueue();
  }

  // ----------------------------------------------------------------- behaviour

  private spawn(): void {
    const slots = this.shelves.stockedSlots();
    // Shuffle, then take 1-3 distinct slots to visit.
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const c = new Customer(V.set(DOOR_OUTSIDE.x, 0, DOOR_OUTSIDE.z));
    const n = Math.min(slots.length, CUSTOMERS.minWishes + Math.floor(Math.random() * (CUSTOMERS.maxWishes - CUSTOMERS.minWishes + 1)));
    for (const slot of slots.slice(0, n)) {
      const cheap = (slot.def?.price ?? 99) <= 5;
      c.wishes.push({ slot, qty: 1 + Math.floor(Math.random() * (cheap ? 3 : 2)) });
    }
    c.walkTo([DOOR_INSIDE]);
    this.scene.add(c.root, c.bubble.sprite);
    this.customers.push(c);
  }

  private think(c: Customer, dt: number): void {
    switch (c.stage) {
      case 'shop': {
        if (!c.idle) return;
        const wish = c.wishes[0];
        if (!wish) {
          this.finishShopping(c);
          return;
        }
        const stand = this.shelves.standPoint(wish.slot, V);
        const front = Math.atan2(wish.slot.proxy.position.x - stand.x, wish.slot.proxy.position.z - stand.z);
        c.walkTo([{ x: stand.x, z: stand.z }], front);
        c.stage = 'browse';
        return;
      }
      case 'browse':
        if (!c.idle) return;
        c.pause(rand(CUSTOMERS.browseMin, CUSTOMERS.browseMax));
        c.stage = 'pick';
        return;
      case 'pick': {
        if (!c.idle) return;
        const wish = c.wishes.shift();
        if (wish?.slot.def) {
          const def = wish.slot.def;
          const got = this.shelves.sell(wish.slot, wish.qty);
          if (got > 0) {
            c.add(def, got);
            haptic(4);
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
        return;
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
      c.walkTo([{ x: QUEUE.x - k * QUEUE.step, z: QUEUE.z }], 0);
      if (c.stage === 'waiting') c.stage = 'queue';
    });
  }

  private leave(c: Customer): void {
    c.stage = 'leaving';
    c.spotIndex = -1;
    c.walkTo([DOOR_INSIDE, DOOR_OUTSIDE]);
  }

  private walkOut(c: Customer): void {
    this.queue.splice(this.queue.indexOf(c), 1);
    this.stats.walkouts++;
    c.bubble.show('😠');
    toast('A customer got tired of waiting and left', 'bad');
    this.leave(c);
  }

  // ------------------------------------------------------------------ checkout

  private head(): Customer | null {
    const c = this.queue[0];
    return c && c.stage === 'waiting' ? c : null;
  }

  private checkout(): void {
    const c = this.head();
    if (!c) return;
    const total = c.total;
    addMoney(total);
    this.stats.served++;
    this.stats.earned += total;
    this.queue.shift();
    c.bubble.show('😊');
    toast(`+$${total.toFixed(2)} · ${c.itemCount} item${c.itemCount === 1 ? '' : 's'}`, 'good');
    haptic([12, 30, 16]);
    this.leave(c);
  }

  private infoFor(): InfoCardData | null {
    const c = this.head();
    if (!c) return null;
    const mood = c.patience < CUSTOMERS.impatientBelow ? '😠 Impatient' : '😊 Happy';
    return {
      key: `cust:${c.itemCount}:${c.total}:${mood}`,
      title: 'Customer ready to pay',
      sub: c.basket.map((l) => `${l.qty}× ${l.def.name}`).join(', '),
      tag: mood,
    };
  }
}
