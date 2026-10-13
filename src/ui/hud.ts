import { gameStore, levelProgress } from '../game/state';

export interface Hud {
  /** Day number, clock text and whether the shop is still open. */
  setClock(day: number, time: string, open: boolean): void;
  /** 0..1 shop cleanliness; the pill only shows when it is low. */
  setClean(value: number): void;
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
    <div class="pill clock"><span>🕘</span><span class="clock-text"></span></div>
    <div class="pill level"><span class="lvl"></span><span class="xpbar"><i></i></span></div>
    <div class="pill messy hidden"><span>🧹</span><span class="messy-text"></span></div>
    <div class="pill delivery hidden"><span>📦</span><span class="delivery-text"></span></div>`;
  parent.appendChild(el);
  const money = el.querySelector<HTMLElement>('.money');
  const value = el.querySelector<HTMLElement>('.money-value');
  const lvl = el.querySelector<HTMLElement>('.lvl');
  const bar = el.querySelector<HTMLElement>('.xpbar i');
  const clock = el.querySelector<HTMLElement>('.clock');
  const clockText = el.querySelector<HTMLElement>('.clock-text');
  const messy = el.querySelector<HTMLElement>('.messy');
  const messyText = el.querySelector<HTMLElement>('.messy-text');
  const delivery = el.querySelector<HTMLElement>('.delivery');
  const deliveryText = el.querySelector<HTMLElement>('.delivery-text');
  if (!clock || !clockText || !messy || !messyText || !lvl || !bar || !money || !value || !delivery || !deliveryText) throw new Error('hud markup');

  let last = gameStore.getState().money;
  const render = (): void => {
    const st = gameStore.getState();
    const m = st.money;
    lvl.textContent = `Lv ${st.level}`;
    bar.style.width = `${Math.round(levelProgress(st) * 100)}%`;
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
  let cleanShown = -1;
  let clockShown = '';
  return {
    setClock(day, time, open) {
      const text = open ? `Day ${day} · ${time}` : `Day ${day} · Closing`;
      if (text === clockShown) return;
      clockShown = text;
      clockText.textContent = text;
      clock.classList.toggle('closing', !open);
    },
    setClean(value) {
      const pct = Math.round(value * 100);
      if (pct === cleanShown) return;
      cleanShown = pct;
      messy.classList.toggle('hidden', value >= 0.8);
      messyText.textContent = `Shop ${pct}% clean`;
    },
    setDeliveryEta(eta) {
      const text = eta === null ? null : `Delivery in ${Math.max(1, Math.ceil(eta))}s`;
      if (text === shown) return;
      shown = text;
      delivery.classList.toggle('hidden', text === null);
      if (text) deliveryText.textContent = text;
    },
  };
}
