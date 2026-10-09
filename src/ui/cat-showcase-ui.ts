import { BREED_BY_ID, RARITIES, type CatActivityId } from '../config/cats';
import type { CatData } from '../game/cat-data';
import type { CatShowcase } from '../game/cat-showcase';

const ACTIONS: Array<[CatActivityId | null, string]> = [
  [null, 'Auto'],
  ['idle', 'Idle'],
  ['sit', 'Sit'],
  ['sleep', 'Sleep'],
  ['stretch', 'Stretch'],
  ['walk', 'Walk'],
  ['play', 'Play'],
  ['eat', 'Eat'],
  ['groom', 'Groom'],
];

/** Temporary M3 panel: force an animation on every cat, meow, reroll. */
export function createShowcasePanel(parent: HTMLElement, showcase: CatShowcase): void {
  const panel = document.createElement('div');
  panel.className = 'showcase-panel';
  const chips = ACTIONS.map(([id, label]) => `<button type="button" class="chip${id === null ? ' active' : ''}" data-act="${id ?? ''}">${label}</button>`);
  chips.push('<button type="button" class="chip accent" data-cmd="meow">Meow!</button>');
  chips.push('<button type="button" class="chip accent" data-cmd="reroll">New cats</button>');
  panel.innerHTML = chips.join('');
  parent.appendChild(panel);

  panel.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    if (cmd === 'meow') return showcase.meowAll();
    if (cmd === 'reroll') return showcase.reroll();
    const act = (btn.dataset.act || null) as CatActivityId | null;
    showcase.forceAll(act);
    for (const b of panel.querySelectorAll('[data-act]')) b.classList.toggle('active', b === btn);
  });
}

export interface CatInfoCard {
  show(cat: CatData | null): void;
}

/** Top-centre card with the targeted cat's name, breed, rarity and personality. */
export function createCatInfoCard(parent: HTMLElement): CatInfoCard {
  const el = document.createElement('div');
  el.className = 'cat-card';
  parent.appendChild(el);
  let currentId: string | null = null;
  return {
    show(cat) {
      const id = cat?.id ?? null;
      if (id === currentId) return;
      currentId = id;
      el.classList.toggle('visible', cat !== null);
      if (!cat) return;
      const breed = BREED_BY_ID[cat.appearance.breedId];
      const coat = breed?.coats[cat.appearance.coatIndex]?.name ?? '';
      const r = RARITIES[cat.rarity];
      el.innerHTML = `
        <div class="cat-card-name">${cat.name}<span class="rarity" style="background:${r.color}">${r.label}</span></div>
        <div class="cat-card-sub">${breed?.name ?? ''} · ${coat}</div>
        <div class="cat-card-tag">${cat.personality}</div>`;
    },
  };
}
