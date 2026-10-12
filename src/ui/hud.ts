import { gameStore } from '../game/state';

export interface Hud {
  /** Seconds until the next delivery (null = none on the way). */
  setDeliveryEta(eta: number | null): void;
}

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Top-left money pill and delivery countdown. */
export function createHud(parent: HTMLElement): Hud {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="pill money"><span class="coin">$</span><span class="money-value"></span></div>
    <div class="pill delivery hidden"><span>📦</span><span class="delivery-text"></span></div>`;
  parent.appendChild(el);
  const money = el.querySelector<HTMLElement>('.money');
  const value = el.querySelector<HTMLElement>('.money-value');
  const delivery = el.querySelector<HTMLElement>('.delivery');
  const deliveryText = el.querySelector<HTMLElement>('.delivery-text');
  if (!money || !value || !delivery || !deliveryText) throw new Error('hud markup');

  let last = gameStore.getState().money;
  const render = (): void => {
    const m = gameStore.getState().money;
    value.textContent = fmt(m);
    if (m !== last) {
      money.classList.remove('gain', 'loss');
      void money.offsetWidth; // restart animation
      money.classList.add(m > last ? 'gain' : 'loss');
      last = m;
    }
  };
  gameStore.subscribe(render);
  render();

  let shown: string | null = null;
  return {
    setDeliveryEta(eta) {
      const text = eta === null ? null : `Delivery in ${Math.max(1, Math.ceil(eta))}s`;
      if (text === shown) return;
      shown = text;
      delivery.classList.toggle('hidden', text === null);
      if (text) deliveryText.textContent = text;
    },
  };
}
