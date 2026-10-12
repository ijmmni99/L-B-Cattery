import type { BoxManager } from '../game/boxes';
import type { CustomerSystem } from '../game/customers';
import type { OrderSystem } from '../game/orders';
import type { ShelfManager } from '../game/shelves';
import { gameStore } from '../game/state';
import type { VillaManager } from '../game/villas';

const DONE_KEY = 'lb-tutorial-done';

interface Deps {
  shelves: ShelfManager;
  boxes: BoxManager;
  orders: OrderSystem;
  customers: CustomerSystem;
  villas: VillaManager | null;
}

/** "What to do next" pill for new players; disappears once the shop reaches level 2. */
export function createGoals(parent: HTMLElement, deps: Deps): { update(dt: number): void; setVisible(v: boolean): void } {
  const el = document.createElement('div');
  el.className = 'goal-pill hidden';
  parent.appendChild(el);
  let done = false;
  try {
    done = localStorage.getItem(DONE_KEY) === '1';
  } catch {
    /* storage blocked: tutorial just shows each visit */
  }
  let timer = 0;
  let shown: string | null = null;
  let forcedHidden = false;

  const pick = (): string | null => {
    if (gameStore.getState().level >= 2) return null;
    const { shelves, boxes, orders, customers, villas } = deps;
    if (shelves.stockedSlots().length === 0) {
      if (orders.nextEta !== null) return '📦 Your delivery is on its way…';
      if (boxes.serialize().length > 0) return '📦 Pick up a box, aim at a shelf and tap to stock it';
      return '📱 Open the tablet and order some supplies';
    }
    if (customers.stats.served === 0) return customers.head() ? '🧾 A customer is ready: tap the register!' : '🛒 Customers are on their way. Serve them at the register';
    if (villas && villas.catCount === 0) return '🐱 Aim at an empty villa and choose a cat to adopt out';
    return '⭐ Keep selling to reach level 2';
  };

  const render = (): void => {
    const goal = forcedHidden ? null : done ? null : pick();
    if (goal === shown) return;
    shown = goal;
    el.classList.toggle('hidden', goal === null);
    if (goal) el.textContent = goal;
  };

  return {
    update(dt) {
      if (done) return;
      timer -= dt;
      if (timer > 0) return;
      timer = 0.5;
      if (gameStore.getState().level >= 2) {
        done = true;
        try {
          localStorage.setItem(DONE_KEY, '1');
        } catch {
          /* ignore */
        }
      }
      render();
    },
    setVisible(v) {
      forcedHidden = !v;
      render();
    },
  };
}
