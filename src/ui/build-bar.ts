import { BUILD_LABEL, type BuildKind } from '../config/build';
import type { BuildMode, BuildTool } from '../game/build-mode';
import { gameStore } from '../game/state';

const HAMMER_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 20.6 13.3 9.3l2.1 2.1L4.1 22.7 2 20.6zM14.7 3.6l1.4-1.4 5.7 5.7-1.4 1.4-1.4-1.4-2.8 2.8-4.2-4.2 2.8-2.8-.1-.1z"/></svg>`;

/** Toggle button plus the tool bar shown while build mode is on. */
export function createBuildBar(parent: HTMLElement, build: BuildMode, hasVillas: boolean, onToggle: (on: boolean) => void): { toggle(): void } {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hud-icon-button build-button';
  button.setAttribute('aria-label', 'Build mode');
  button.innerHTML = HAMMER_ICON;
  parent.appendChild(button);

  const bar = document.createElement('div');
  bar.className = 'build-bar';
  bar.hidden = true;
  parent.appendChild(bar);

  const kinds: BuildKind[] = hasVillas ? ['gondola', 'bench', 'villa'] : ['gondola', 'bench'];

  const isActive = (t: BuildTool, id: string): boolean => (t.mode === 'place' ? t.kind === id : t.mode === id);
  const render = (): void => {
    const money = gameStore.getState().money;
    const chips = kinds
      .map((k) => {
        const cost = build.costOf(k);
        return `<button type="button" class="chip tool${isActive(build.tool, k) ? ' active' : ''}${money < cost ? ' short' : ''}" data-tool="${k}">
          <span>${BUILD_LABEL[k].icon} ${BUILD_LABEL[k].name}</span><small>$${cost}</small></button>`;
      })
      .join('');
    bar.innerHTML = `
      <div class="build-tools">
        ${chips}
        <button type="button" class="chip tool${isActive(build.tool, 'move') ? ' active' : ''}" data-tool="move"><span>✋ Move</span></button>
        <button type="button" class="chip tool${isActive(build.tool, 'sell') ? ' active' : ''}" data-tool="sell"><span>🗑️ Sell</span></button>
        <button type="button" class="chip rotate" data-act="rotate"><span>⟳</span></button>
        <button type="button" class="chip done" data-act="done"><span>✓ Done</span></button>
      </div>
      <div class="build-status${build.status.ok ? '' : ' bad'}">${build.status.text}</div>`;
  };

  const setOn = (on: boolean): void => {
    if (on === build.active) return;
    if (on) {
      if (document.pointerLockElement) document.exitPointerLock();
      build.enter();
    } else build.exit();
    bar.hidden = !on;
    button.classList.toggle('on', on);
    onToggle(on);
    render();
  };
  button.addEventListener('click', () => setOn(!build.active));
  bar.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tool],[data-act]');
    if (!el) return;
    if (el.dataset.tool) {
      const t = el.dataset.tool;
      build.setTool(t === 'move' || t === 'sell' ? { mode: t } : { mode: 'place', kind: t as BuildKind });
    } else if (el.dataset.act === 'rotate') build.rotate();
    else if (el.dataset.act === 'done') setOn(false);
  });
  build.onChange(() => {
    if (build.active) render();
  });
  gameStore.subscribe(() => {
    if (build.active) render();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyB') setOn(!build.active);
    else if (e.code === 'KeyR' && build.active) build.rotate();
  });
  return { toggle: () => setOn(!build.active) };
}
