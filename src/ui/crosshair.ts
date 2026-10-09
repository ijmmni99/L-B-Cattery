export interface Crosshair {
  /** Label shown under the dot; null = nothing targeted. */
  setTarget(label: string | null): void;
}

/** Centre aim dot; grows and shows the action name when on a target. */
export function createCrosshair(parent: HTMLElement): Crosshair {
  const el = document.createElement('div');
  el.className = 'crosshair';
  el.innerHTML = '<div class="crosshair-dot"></div><div class="crosshair-label"></div>';
  const label = el.querySelector<HTMLDivElement>('.crosshair-label');
  parent.appendChild(el);
  let current: string | null | undefined;
  return {
    setTarget(text) {
      if (text === current) return;
      current = text;
      el.classList.toggle('on-target', text !== null);
      if (label) label.textContent = text ?? '';
    },
  };
}
