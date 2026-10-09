export interface Crosshair {
  setOnTarget(on: boolean): void;
}

/** Small centre aim dot; turns mint and grows when on an interactable. */
export function createCrosshair(parent: HTMLElement): Crosshair {
  const el = document.createElement('div');
  el.className = 'crosshair';
  parent.appendChild(el);
  let current: boolean | undefined;
  return {
    setOnTarget(on) {
      if (on === current) return;
      current = on;
      el.classList.toggle('on-target', on);
    },
  };
}
