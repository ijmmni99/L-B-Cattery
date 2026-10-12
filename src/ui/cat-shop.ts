import { BREED_BY_ID, RARITIES } from '../config/cats';
import { maxRarityFor } from '../config/progression';
import { OFFERS_PER_ROLL, REROLL_COST } from '../config/villas';
import { haptic } from '../core/haptics';
import { sfx } from '../core/sfx';
import { catPrice, generateCat, type CatData } from '../game/cat-data';
import { gameStore, spendMoney } from '../game/state';
import type { Villa, VillaManager } from '../game/villas';
import { toast } from './toast';

/** Shelter panel: pick one of a few cats to move into an empty villa. */
export function createCatShop(parent: HTMLElement, villas: VillaManager): (villa: Villa) => void {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.innerHTML = `<div class="sheet cat-shop-sheet" role="dialog" aria-label="Cat shelter"></div>`;
  parent.appendChild(overlay);
  const sheet = overlay.querySelector<HTMLElement>('.cat-shop-sheet') as HTMLElement;

  let target: Villa | null = null;
  let offers: CatData[] = [];

  const roll = (): void => {
    offers = Array.from({ length: OFFERS_PER_ROLL }, () => generateCat({ maxRarity: maxRarityFor(gameStore.getState().level) }));
  };

  const render = (): void => {
    const money = gameStore.getState().money;
    const cards = offers
      .map((cat, i) => {
        const breed = BREED_BY_ID[cat.appearance.breedId];
        const coat = breed.coats[cat.appearance.coatIndex];
        const r = RARITIES[cat.rarity];
        const price = catPrice(cat);
        return `<div class="cat-card">
          <div class="cat-swatch" style="background:${coat.base};border-color:${coat.dark}">🐱</div>
          <div class="cat-info">
            <div class="cat-name">${cat.name} <span class="badge" style="background:${r.color}">${r.label}</span></div>
            <div class="cat-sub">${breed.name} · ${coat.name}</div>
            <div class="cat-sub">${cat.personality}</div>
          </div>
          <button type="button" class="adopt-btn" data-act="adopt" data-i="${i}" ${money < price ? 'disabled' : ''}>$${price}</button>
        </div>`;
      })
      .join('');
    sheet.innerHTML = `
      <div class="sheet-header"><h2>Cat shelter</h2><button type="button" class="sheet-close" data-act="close" aria-label="Close">✕</button></div>
      <p class="hint">Pick a cat for Villa ${target ? target.index + 1 : ''}</p>
      <div class="cat-list">${cards}</div>
      <button type="button" class="ghost-btn reroll" data-act="reroll" ${money < REROLL_COST ? 'disabled' : ''}>🔄 New cats · $${REROLL_COST}</button>`;
  };

  const close = (): void => {
    overlay.classList.remove('open');
    target = null;
  };

  sheet.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || !target) return;
    if (el.dataset.act === 'close') close();
    else if (el.dataset.act === 'reroll') {
      if (!spendMoney(REROLL_COST)) return;
      sfx.cash();
      roll();
      render();
    } else if (el.dataset.act === 'adopt') {
      const cat = offers[Number(el.dataset.i)];
      if (!cat || target.cat) return;
      if (!spendMoney(catPrice(cat))) {
        toast('Not enough money', 'bad');
        return;
      }
      villas.assignCat(target, cat);
      sfx.done();
      haptic([12, 30, 16]);
      toast(`${cat.name} moved in!`, 'good');
      close();
    }
  });
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && target) close();
  });
  gameStore.subscribe(() => {
    if (target) render();
  });

  return (villa) => {
    if (document.pointerLockElement) document.exitPointerLock();
    target = villa;
    roll();
    render();
    overlay.classList.add('open');
  };
}
