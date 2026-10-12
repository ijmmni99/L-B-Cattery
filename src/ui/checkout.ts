import { CUSTOMERS } from '../config/customers';
import { haptic } from '../core/haptics';
import { sfx } from '../core/sfx';
import type { Customer } from '../game/customer';
import type { CustomerSystem } from '../game/customers';
import { toast } from './toast';

const BILLS = [5, 10, 20, 50, 100] as const;
const CHANGE_NOTES = [1, 5, 10, 20] as const;
const cents = (n: number): number => Math.round(n * 100) / 100;
const fmt = (n: number): string => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

/** Decide how a customer pays: card, exact cash, or a bill that needs change. */
function pickPayment(total: number): NonNullable<Customer['payment']> {
  if (Math.random() < 0.35) return { method: 'card', tender: total };
  const fits = BILLS.filter((b) => b >= total);
  const tender = Math.random() < 0.15 ? Math.ceil(total) : fits[Math.random() < 0.7 ? 0 : Math.min(1, fits.length - 1)] ?? Math.ceil(total / 50) * 50;
  return { method: 'cash', tender };
}

/**
 * Register panel: scan every item, take payment, then count out the change.
 * Overpaying the change costs the shop; exact change from a happy customer can earn a tip.
 */
export function createCheckoutPanel(parent: HTMLElement, system: CustomerSystem): void {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay checkout-overlay';
  overlay.innerHTML = `<div class="sheet checkout-sheet" role="dialog" aria-label="Checkout"></div>`;
  parent.appendChild(overlay);
  const sheet = overlay.querySelector<HTMLElement>('.checkout-sheet') as HTMLElement;

  let c: Customer | null = null;
  let phase: 'scan' | 'pay' = 'scan';
  let given = new Map<number, number>();
  let message = '';

  const givenTotal = (): number => cents([...given].reduce((n, [v, k]) => n + v * k, 0));
  const due = (): number => (c?.payment ? cents(c.payment.tender - c.total) : 0);
  const remaining = (id: string, qty: number): number => qty - (c?.scanned.get(id) ?? 0);
  const scannedValue = (): number => (c ? cents(c.basket.reduce((n, l) => n + l.price * (c?.scanned.get(l.id) ?? 0), 0)) : 0);
  const allScanned = (): boolean => (c ? c.scannedCount >= c.itemCount : false);

  const close = (finished: boolean): void => {
    if (c && !finished) system.cancelCheckout(c);
    c = null;
    overlay.classList.remove('open');
  };

  const render = (): void => {
    if (!c) return;
    const happy = c.patience >= CUSTOMERS.impatientBelow;
    const head = `
      <div class="sheet-header">
        <h2>Register</h2>
        <span class="mood">${happy ? '😊' : '😠'}</span>
        <button type="button" class="sheet-close" data-act="close" aria-label="Close">✕</button>
      </div>`;
    if (phase === 'scan') {
      const rows = c.basket
        .map((l) => {
          const left = remaining(l.id, l.qty);
          const done = l.qty - left;
          return `<button type="button" class="scan-row${left === 0 ? ' done' : ''}" data-act="scan" data-id="${l.id}">
            <span class="scan-icon" style="background:${l.color}">${l.icon}</span>
            <span class="scan-name">${l.name}<small>${fmt(l.price)} each</small></span>
            <span class="scan-count">${left === 0 ? '✓' : `${done}/${l.qty}`}</span>
          </button>`;
        })
        .join('');
      sheet.innerHTML = `${head}
        <p class="hint">Tap each item to scan it</p>
        <div class="scan-list">${rows}</div>
        <div class="receipt"><span>Scanned</span><b>${fmt(scannedValue())}</b></div>
        <button type="button" class="big-btn" data-act="${allScanned() ? 'pay' : 'scan-next'}">${allScanned() ? 'Take payment →' : 'Scan next item'}</button>`;
      return;
    }
    const pay = c.payment as NonNullable<Customer['payment']>;
    if (pay.method === 'card') {
      sheet.innerHTML = `${head}
        <div class="receipt big"><span>Total</span><b>${fmt(c.total)}</b></div>
        <div class="pay-card">💳 Customer taps their card</div>
        <button type="button" class="big-btn" data-act="charge">Charge ${fmt(c.total)}</button>`;
      return;
    }
    const d = due();
    const notes = CHANGE_NOTES.map(
      (v) => `<button type="button" class="note n${v}" data-act="give" data-v="${v}">${fmt(v)}${given.get(v) ? `<i>${given.get(v)}</i>` : ''}</button>`,
    ).join('');
    sheet.innerHTML = `${head}
      <div class="receipt"><span>Total</span><b>${fmt(c.total)}</b></div>
      <div class="receipt"><span>Customer pays cash</span><b>${fmt(pay.tender)}</b></div>
      <div class="receipt change"><span>Change due</span><b>${fmt(d)}</b></div>
      <div class="notes">${notes}</div>
      <div class="receipt given"><span>Giving back</span><b>${fmt(givenTotal())}</b></div>
      <p class="hint msg">${message}</p>
      <div class="row-btns">
        <button type="button" class="ghost-btn" data-act="clear">Clear</button>
        <button type="button" class="big-btn" data-act="change">${d === 0 ? 'Done' : 'Give change'}</button>
      </div>`;
  };

  const scanOne = (id?: string): void => {
    if (!c) return;
    const line = c.basket.find((l) => (id ? l.id === id : remaining(l.id, l.qty) > 0) && remaining(l.id, l.qty) > 0);
    if (!line) return;
    c.scanned.set(line.id, (c.scanned.get(line.id) ?? 0) + 1);
    sfx.scan();
    haptic(8);
    if (allScanned()) {
      c.payment ??= pickPayment(c.total);
      sfx.coin();
    }
    render();
  };

  const finish = (extra: number): void => {
    if (!c) return;
    const done = c;
    sfx.done();
    close(true);
    system.completeCheckout(done, extra);
  };

  const settleChange = (): void => {
    if (!c) return;
    const d = due();
    const g = givenTotal();
    if (g < d) {
      sfx.error();
      haptic([30, 40, 30]);
      message = `Not enough! You still owe ${fmt(cents(d - g))}`;
      render();
      return;
    }
    if (g > d) {
      toast(`Overpaid ${fmt(cents(g - d))} in change`, 'bad');
      finish(-cents(g - d));
      return;
    }
    const tip = c.patience >= CUSTOMERS.impatientBelow && Math.random() < 0.6 ? 1 + Math.floor(Math.random() * 3) : 0;
    finish(tip);
  };

  sheet.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || !c) return;
    switch (el.dataset.act) {
      case 'close':
        close(false);
        break;
      case 'scan':
        scanOne(el.dataset.id);
        break;
      case 'scan-next':
        scanOne();
        break;
      case 'pay':
        phase = 'pay';
        message = '';
        given = new Map();
        render();
        break;
      case 'charge':
        sfx.coin();
        finish(c.patience >= CUSTOMERS.impatientBelow && Math.random() < 0.3 ? 1 : 0);
        break;
      case 'give': {
        const v = Number(el.dataset.v);
        given.set(v, (given.get(v) ?? 0) + 1);
        message = '';
        sfx.cash();
        haptic(6);
        render();
        break;
      }
      case 'clear':
        given = new Map();
        message = '';
        render();
        break;
      case 'change':
        settleChange();
        break;
    }
  });
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && c) close(false);
  });

  system.onCheckout = (customer) => {
    if (document.pointerLockElement) document.exitPointerLock();
    c = customer;
    phase = c.payment && allScanned() ? 'pay' : 'scan';
    given = new Map();
    message = '';
    overlay.classList.add('open');
    render();
  };
}
