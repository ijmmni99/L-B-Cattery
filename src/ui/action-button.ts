import { haptic } from '../core/haptics';
import type { Input } from '../core/input';

const HAND_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3.5a1.5 1.5 0 0 1 3 0V11h.5V5a1.5 1.5 0 0 1 3 0v6h.5V7a1.5 1.5 0 0 1 3 0v8.5c0 3.6-2.9 6.5-6.5 6.5h-.8a6.5 6.5 0 0 1-5.2-2.6L3.2 15a1.6 1.6 0 0 1 2.5-2L8 15.6 9 16V3.5z"/></svg>`;

export interface ActionButton {
  /** null hides the label and dims the button. */
  setLabel(label: string | null): void;
}

/** Big context action button (bottom-right). Also fires on E / Space. */
export function createActionButton(parent: HTMLElement, input: Input): ActionButton {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'action-button';
  btn.innerHTML = `${HAND_ICON}<span class="action-label"></span>`;
  const label = btn.querySelector<HTMLSpanElement>('.action-label');
  parent.appendChild(btn);

  // undefined = never set, so the first setLabel(null) still applies 'idle'.
  let current: string | null | undefined;

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.classList.add('pressed');
    if (current) {
      haptic(18);
      input.fireAction();
    }
  });
  const release = (): void => btn.classList.remove('pressed');
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointerleave', release);
  btn.addEventListener('pointercancel', release);

  return {
    setLabel(text) {
      if (text === current) return;
      current = text;
      btn.classList.toggle('idle', text === null);
      if (label) label.textContent = text ?? '';
    },
  };
}
