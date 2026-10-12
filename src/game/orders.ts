import { PRODUCT_BY_ID, boxCost } from '../config/products';
import { toast } from '../ui/toast';
import type { BoxManager } from './boxes';
import { DELIVERY_SECONDS, spendMoney } from './state';

interface PendingOrder {
  lines: Record<string, number>;
  eta: number;
}

export type OrderResult = { ok: true; total: number } | { ok: false; reason: string };

/** Supply orders: pay now, boxes arrive on the delivery pad after a short delay. */
export class OrderSystem {
  private readonly pending: PendingOrder[] = [];

  constructor(private readonly boxes: BoxManager) {}

  /** Cost of a basket (boxes per product id). */
  static total(lines: Record<string, number>): number {
    let t = 0;
    for (const [id, n] of Object.entries(lines)) t += boxCost(PRODUCT_BY_ID[id]) * n;
    return t;
  }

  place(lines: Record<string, number>): OrderResult {
    const clean: Record<string, number> = {};
    for (const [id, n] of Object.entries(lines)) if (n > 0 && PRODUCT_BY_ID[id]) clean[id] = n;
    if (Object.keys(clean).length === 0) return { ok: false, reason: 'Pick something first' };
    const total = OrderSystem.total(clean);
    if (!spendMoney(total)) return { ok: false, reason: 'Not enough money' };
    this.pending.push({ lines: clean, eta: DELIVERY_SECONDS });
    toast(`Ordered · arrives in ${DELIVERY_SECONDS}s`, 'good');
    return { ok: true, total };
  }

  /** Seconds until the next delivery, or null when nothing is on the way. */
  get nextEta(): number | null {
    if (this.pending.length === 0) return null;
    return Math.min(...this.pending.map((o) => o.eta));
  }

  update(dt: number): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const o = this.pending[i];
      o.eta -= dt;
      if (o.eta <= 0) {
        this.pending.splice(i, 1);
        this.boxes.spawnDelivery(o.lines);
        toast('Delivery arrived! Check the pad', 'good');
      }
    }
  }
}
