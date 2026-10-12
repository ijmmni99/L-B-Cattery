import type { InfoCardData } from '../game/interactions';

export interface InfoCard {
  show(data: InfoCardData | null): void;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

/** Small card above the HUD describing whatever the crosshair is on. */
export function createInfoCard(parent: HTMLElement): InfoCard {
  const el = document.createElement('div');
  el.className = 'info-card';
  parent.appendChild(el);
  let currentKey: string | null = null;
  return {
    show(data) {
      const key = data?.key ?? null;
      if (key === currentKey) return;
      currentKey = key;
      el.classList.toggle('visible', data !== null);
      if (!data) return;
      const badge = data.badge ? `<span class="rarity" style="background:${data.badge.color}">${esc(data.badge.text)}</span>` : '';
      el.innerHTML = `
        <div class="info-card-name">${esc(data.title)}${badge}</div>
        ${data.sub ? `<div class="info-card-sub">${esc(data.sub)}</div>` : ''}
        ${data.tag ? `<div class="info-card-tag">${esc(data.tag)}</div>` : ''}`;
    },
  };
}
