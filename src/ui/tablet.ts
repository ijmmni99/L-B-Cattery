import { CATEGORIES, PRODUCTS, PRODUCT_BY_ID, boxCost, type ProductDef } from '../config/products';
import { haptic } from '../core/haptics';
import { OrderSystem } from '../game/orders';
import type { StaffSystem } from '../game/staff';
import { STAFF, WAGE_INTERVAL } from '../config/care';
import { DELIVERY_SECONDS, gameStore, onPriceChange, setProductPrice } from '../game/state';
import { DEFAULT_PRICE } from '../config/products';
import { toast } from './toast';

const TABLET_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7zm5 14.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z"/></svg>`;

const TABS: Array<{ id: string; label: string; ready: boolean }> = [
  { id: 'supplies', label: 'Supplies', ready: true },
  { id: 'cats', label: 'Cats', ready: false },
  { id: 'prices', label: 'Prices', ready: true },
  { id: 'staff', label: 'Staff', ready: true },
];

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/**
 * Tablet: order supplies by the box. Other tabs arrive with later milestones.
 * Opens from the HUD button or the T key.
 */
export function createTablet(parent: HTMLElement, orders: OrderSystem, staff: StaffSystem, onOpenChange?: (open: boolean) => void): { open(): void; close(): void } {
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
      <div class="tab-body prices-body" hidden></div>
      <div class="tab-body staff-body" hidden></div>
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
    <div class="product-row${p.unlockLevel > gameStore.getState().level ? ' locked' : ''}" data-id="${p.id}">
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
      <span class="lock-tag">🔒 Lv ${p.unlockLevel}</span>
    </div>`;
  body.innerHTML = CATEGORIES.map((c) => {
    const items = PRODUCTS.filter((p) => p.category === c.id);
    return `<h3 class="cat-title">${c.icon} ${c.label}</h3>${items.map(row).join('')}`;
  }).join('');

  const pricesBody = q<HTMLElement>('.prices-body');
  const renderPrices = (): void => {
    const level = gameStore.getState().level;
    pricesBody.innerHTML =
      `<p class="hint">Customers buy less when you charge much more than the suggested price, and more when it's cheap.</p>` +
      PRODUCTS.filter((p) => p.unlockLevel <= level)
        .map((p) => {
          const margin = p.price - p.cost;
          return `<div class="product-row price-row" data-id="${p.id}">
            <div class="product-icon" style="background:${p.color}">${p.icon}</div>
            <div class="product-info">
              <div class="product-name">${p.name}</div>
              <div class="product-sub">Cost $${fmt(p.cost)} · suggested $${fmt(DEFAULT_PRICE[p.id])}</div>
              <div class="margin ${margin > 0 ? 'good' : 'bad'}">${margin >= 0 ? '+' : '−'}$${fmt(Math.abs(margin))} profit each</div>
            </div>
            <div class="stepper">
              <button type="button" class="pstep" data-d="-1" aria-label="Lower price">−</button>
              <span class="step-qty">$${fmt(p.price)}</span>
              <button type="button" class="pstep" data-d="1" aria-label="Raise price">+</button>
            </div>
          </div>`;
        })
        .join('');
  };
  pricesBody.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.pstep');
    const rowEl = (e.target as HTMLElement).closest<HTMLElement>('.price-row');
    if (!btn || !rowEl) return;
    const id = rowEl.dataset.id ?? '';
    setProductPrice(id, PRODUCT_BY_ID[id].price + Number(btn.dataset.d));
    haptic(6);
  });
  onPriceChange(renderPrices);
  renderPrices();

  const staffBody = q<HTMLElement>('.staff-body');
  const renderStaff = (): void => {
    const level = gameStore.getState().level;
    const money = gameStore.getState().money;
    staffBody.innerHTML =
      `<p class="hint">Helpers are paid every ${WAGE_INTERVAL}s. If you can't pay, they quit.</p>` +
      STAFF.map((d) => {
        const hired = staff.has(d.role);
        const locked = level < d.hireLevel;
        const fee = staff.hireCost(d.role);
        const action = hired
          ? `<button type="button" class="adopt-btn fire" data-role="${d.role}" data-do="fire">Fire</button>`
          : `<button type="button" class="adopt-btn" data-role="${d.role}" data-do="hire" ${locked || money < fee ? 'disabled' : ''}>${locked ? `🔒 Lv ${d.hireLevel}` : `Hire $${fee}`}</button>`;
        return `<div class="product-row staff-row">
          <div class="product-icon" style="background:${d.apron}">${d.icon}</div>
          <div class="product-info">
            <div class="product-name">${d.name}${hired ? ' ✓' : ''}</div>
            <div class="product-sub">${d.desc}</div>
            <div class="product-price">$${d.wage} / ${WAGE_INTERVAL}s</div>
          </div>
          ${action}
        </div>`;
      }).join('');
  };
  staffBody.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-do]');
    if (!btn) return;
    const role = btn.dataset.role as 'cashier' | 'cleaner' | 'caretaker';
    if (btn.dataset.do === 'fire') staff.fire(role);
    else {
      const res = staff.hire(role);
      if (res.ok) toast('Hired!', 'good');
      else toast(res.reason, 'bad');
    }
    renderStaff();
  });
  gameStore.subscribe(() => {
    if (!staffBody.hidden) renderStaff();
  });

  const lines = (): Record<string, number> => Object.fromEntries([...qty].filter(([, n]) => n > 0));
  const refresh = (): void => {
    const total = OrderSystem.total(lines());
    const money = gameStore.getState().money;
    totalEl.textContent = `$${fmt(total)}`;
    moneyEl.textContent = fmt(money);
    orderBtn.disabled = total === 0;
    orderBtn.classList.toggle('short', total > money);
    orderBtn.textContent = total > money ? 'Not enough $' : 'Order';
    const level = gameStore.getState().level;
    for (const r of body.querySelectorAll<HTMLElement>('.product-row')) {
      const n = qty.get(r.dataset.id ?? '') ?? 0;
      r.classList.toggle('locked', PRODUCT_BY_ID[r.dataset.id ?? ''].unlockLevel > level);
      r.classList.toggle('has', n > 0);
      const label = r.querySelector('.step-qty');
      if (label) label.textContent = String(n);
    }
  };
  gameStore.subscribe(refresh);

  body.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.step');
    const rowEl = (e.target as HTMLElement).closest<HTMLElement>('.product-row');
    if (!btn || !rowEl || rowEl.classList.contains('locked')) return;
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
      const id = tab.dataset.tab;
      body.hidden = id !== 'supplies';
      pricesBody.hidden = id !== 'prices';
      staffBody.hidden = id !== 'staff';
      soonBody.hidden = id === 'supplies' || id === 'prices' || id === 'staff';
      (overlay.querySelector('.order-bar') as HTMLElement).hidden = id !== 'supplies';
      if (id === 'prices') renderPrices();
      if (id === 'staff') renderStaff();
    });
  }

  const setOpen = (open: boolean): void => {
    overlay.classList.toggle('open', open);
    if (open) {
      if (document.pointerLockElement) document.exitPointerLock();
      refresh();
      renderPrices();
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
