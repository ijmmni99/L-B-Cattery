import { CATEGORIES, PRODUCTS, boxCost, type ProductDef } from '../config/products';
import { haptic } from '../core/haptics';
import { OrderSystem } from '../game/orders';
import { DELIVERY_SECONDS, gameStore } from '../game/state';
import { toast } from './toast';

const TABLET_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7zm5 14.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z"/></svg>`;

const TABS: Array<{ id: string; label: string; ready: boolean }> = [
  { id: 'supplies', label: 'Supplies', ready: true },
  { id: 'cats', label: 'Cats', ready: false },
  { id: 'prices', label: 'Prices', ready: false },
  { id: 'upgrades', label: 'Upgrades', ready: false },
  { id: 'staff', label: 'Staff', ready: false },
];

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/**
 * Tablet: order supplies by the box. Other tabs arrive with later milestones.
 * Opens from the HUD button or the T key.
 */
export function createTablet(parent: HTMLElement, orders: OrderSystem, onOpenChange?: (open: boolean) => void): { open(): void; close(): void } {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hud-icon-button tablet-button';
  button.setAttribute('aria-label', 'Tablet');
  button.innerHTML = TABLET_ICON;
  parent.appendChild(button);

  const qty = new Map<string, number>();
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.innerHTML = `
    <div class="sheet tablet-sheet" role="dialog" aria-label="Tablet">
      <div class="sheet-header">
        <h2>Tablet</h2>
        <div class="tablet-money pill"><span class="coin">$</span><span class="tablet-money-value"></span></div>
        <button type="button" class="sheet-close" aria-label="Close">✕</button>
      </div>
      <div class="tabs">${TABS.map((t) => `<button type="button" class="tab${t.id === 'supplies' ? ' active' : ''}${t.ready ? '' : ' soon'}" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
      <div class="tab-body supplies-body"></div>
      <div class="tab-body soon-body" hidden><p>Coming soon!</p></div>
      <div class="order-bar">
        <div class="order-total"><span>Total</span><b class="order-total-value">$0</b><small>Delivery in ~${DELIVERY_SECONDS}s</small></div>
        <button type="button" class="order-button" disabled>Order</button>
      </div>
    </div>`;
  parent.appendChild(overlay);

  const q = <T extends Element>(sel: string): T => {
    const el = overlay.querySelector<T>(sel);
    if (!el) throw new Error(`tablet: missing ${sel}`);
    return el;
  };
  const body = q<HTMLElement>('.supplies-body');
  const soonBody = q<HTMLElement>('.soon-body');
  const totalEl = q<HTMLElement>('.order-total-value');
  const orderBtn = q<HTMLButtonElement>('.order-button');
  const moneyEl = q<HTMLElement>('.tablet-money-value');

  const row = (p: ProductDef): string => `
    <div class="product-row" data-id="${p.id}">
      <div class="product-icon" style="background:${p.color}">${p.icon}</div>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-sub">${p.sub} · box of ${p.boxSize} · $${fmt(p.cost)} each</div>
        <div class="product-price">$${fmt(boxCost(p))} / box</div>
      </div>
      <div class="stepper">
        <button type="button" class="step minus" aria-label="Fewer">−</button>
        <span class="step-qty">0</span>
        <button type="button" class="step plus" aria-label="More">+</button>
      </div>
    </div>`;
  body.innerHTML = CATEGORIES.map((c) => {
    const items = PRODUCTS.filter((p) => p.category === c.id);
    return `<h3 class="cat-title">${c.icon} ${c.label}</h3>${items.map(row).join('')}`;
  }).join('');

  const lines = (): Record<string, number> => Object.fromEntries([...qty].filter(([, n]) => n > 0));
  const refresh = (): void => {
    const total = OrderSystem.total(lines());
    const money = gameStore.getState().money;
    totalEl.textContent = `$${fmt(total)}`;
    moneyEl.textContent = fmt(money);
    orderBtn.disabled = total === 0;
    orderBtn.classList.toggle('short', total > money);
    orderBtn.textContent = total > money ? 'Not enough $' : 'Order';
    for (const r of body.querySelectorAll<HTMLElement>('.product-row')) {
      const n = qty.get(r.dataset.id ?? '') ?? 0;
      r.classList.toggle('has', n > 0);
      const label = r.querySelector('.step-qty');
      if (label) label.textContent = String(n);
    }
  };
  gameStore.subscribe(refresh);

  body.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.step');
    const rowEl = (e.target as HTMLElement).closest<HTMLElement>('.product-row');
    if (!btn || !rowEl) return;
    const id = rowEl.dataset.id ?? '';
    const cur = qty.get(id) ?? 0;
    qty.set(id, Math.min(20, Math.max(0, cur + (btn.classList.contains('plus') ? 1 : -1))));
    haptic(8);
    refresh();
  });

  orderBtn.addEventListener('click', () => {
    const res = orders.place(lines());
    if (!res.ok) {
      toast(res.reason, 'bad');
      return;
    }
    haptic([10, 30, 10]);
    qty.clear();
    refresh();
    setOpen(false);
  });

  for (const tab of overlay.querySelectorAll<HTMLButtonElement>('.tab')) {
    tab.addEventListener('click', () => {
      for (const t of overlay.querySelectorAll('.tab')) t.classList.toggle('active', t === tab);
      const supplies = tab.dataset.tab === 'supplies';
      body.hidden = !supplies;
      soonBody.hidden = supplies;
      (overlay.querySelector('.order-bar') as HTMLElement).hidden = !supplies;
    });
  }

  const setOpen = (open: boolean): void => {
    overlay.classList.toggle('open', open);
    if (open) {
      if (document.pointerLockElement) document.exitPointerLock();
      refresh();
    }
    onOpenChange?.(open);
  };
  button.addEventListener('click', () => setOpen(true));
  q<HTMLButtonElement>('.sheet-close').addEventListener('click', () => setOpen(false));
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) setOpen(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyT') setOpen(!overlay.classList.contains('open'));
    else if (e.code === 'Escape') setOpen(false);
  });
  refresh();
  return { open: () => setOpen(true), close: () => setOpen(false) };
}
