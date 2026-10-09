import type { QualityLevel } from '../core/quality';
import { getSettings, updateSettings } from '../core/settings';

const GEAR_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.4 4.6.1-1.1-.1-1.1 2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7.6 7.6 0 0 0-1.9-1.1l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5c-.7.3-1.3.6-1.9 1.1l-2.4-1a.5.5 0 0 0-.6.2L1.6 8.7a.5.5 0 0 0 .1.6l2 1.6-.1 1.1.1 1.1-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3c.1.2.4.3.6.2l2.4-1c.6.5 1.2.8 1.9 1.1l.4 2.5c0 .2.3.4.5.4h3.8c.2 0 .5-.2.5-.4l.4-2.5c.7-.3 1.3-.6 1.9-1.1l2.4 1c.2.1.5 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6l-2-1.6z"/></svg>`;

const QUALITY: Array<[QualityLevel, string]> = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
];

/**
 * Gear button + Settings sheet (side panel in landscape, bottom sheet in
 * portrait). Changes apply live and persist.
 */
export function createSettingsPanel(parent: HTMLElement, onOpenChange?: (open: boolean) => void): void {
  const gear = document.createElement('button');
  gear.type = 'button';
  gear.className = 'hud-icon-button settings-gear';
  gear.setAttribute('aria-label', 'Settings');
  gear.innerHTML = GEAR_ICON;
  parent.appendChild(gear);

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  const s = getSettings();
  overlay.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Settings">
      <div class="sheet-header"><h2>Settings</h2><button type="button" class="sheet-close" aria-label="Close">✕</button></div>
      <div class="setting-row">
        <span>Graphics</span>
        <div class="segmented">${QUALITY.map(([id, l]) => `<button type="button" data-q="${id}">${l}</button>`).join('')}</div>
      </div>
      <label class="setting-row">
        <span>Look sensitivity <b class="sens-value"></b></span>
        <input type="range" class="sens" min="0.3" max="2" step="0.05" value="${s.lookSensitivity}">
      </label>
      <label class="setting-row toggle-row"><span>Head bob</span><input type="checkbox" class="toggle bob" ${s.headBob ? 'checked' : ''}></label>
      <label class="setting-row toggle-row"><span>Vibration</span><input type="checkbox" class="toggle haptics" ${s.haptics ? 'checked' : ''}></label>
    </div>`;
  parent.appendChild(overlay);

  const q = <T extends Element>(sel: string): T => {
    const el = overlay.querySelector<T>(sel);
    if (!el) throw new Error(`settings: missing ${sel}`);
    return el;
  };
  const sens = q<HTMLInputElement>('.sens');
  const sensValue = q<HTMLElement>('.sens-value');
  const qButtons = [...overlay.querySelectorAll<HTMLButtonElement>('[data-q]')];

  const refresh = (): void => {
    const cur = getSettings();
    for (const b of qButtons) b.classList.toggle('active', b.dataset.q === cur.quality);
    sensValue.textContent = `${cur.lookSensitivity.toFixed(2)}×`;
  };

  for (const b of qButtons) {
    b.addEventListener('click', () => {
      updateSettings({ quality: b.dataset.q as QualityLevel });
      refresh();
    });
  }
  sens.addEventListener('input', () => {
    updateSettings({ lookSensitivity: Number(sens.value) });
    refresh();
  });
  q<HTMLInputElement>('.bob').addEventListener('change', (e) => {
    updateSettings({ headBob: (e.target as HTMLInputElement).checked });
  });
  q<HTMLInputElement>('.haptics').addEventListener('change', (e) => {
    updateSettings({ haptics: (e.target as HTMLInputElement).checked });
  });

  const setOpen = (open: boolean): void => {
    overlay.classList.toggle('open', open);
    if (open && document.pointerLockElement) document.exitPointerLock();
    onOpenChange?.(open);
  };
  gear.addEventListener('click', () => setOpen(true));
  q<HTMLButtonElement>('.sheet-close').addEventListener('click', () => setOpen(false));
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) setOpen(false);
  });
  refresh();
}
