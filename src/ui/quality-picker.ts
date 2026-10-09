import type { QualityLevel } from '../core/quality';

const LEVELS: Array<{ id: QualityLevel; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Med' },
  { id: 'high', label: 'High' },
];

/** Temporary M0 quality switcher; moves into the Settings menu in M9. */
export function createQualityPicker(
  parent: HTMLElement,
  initial: QualityLevel,
  onChange: (level: QualityLevel) => void,
): void {
  const wrap = document.createElement('div');
  wrap.className = 'quality-picker';
  const buttons: HTMLButtonElement[] = [];

  for (const { id, label } of LEVELS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.dataset.level = id;
    btn.classList.toggle('active', id === initial);
    btn.addEventListener('click', () => {
      for (const b of buttons) b.classList.toggle('active', b === btn);
      onChange(id);
    });
    buttons.push(btn);
    wrap.appendChild(btn);
  }
  parent.appendChild(wrap);
}
