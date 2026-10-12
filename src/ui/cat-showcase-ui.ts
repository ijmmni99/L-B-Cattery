import type { CatActivityId } from '../config/cats';
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
