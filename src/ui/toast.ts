let host: HTMLElement | null = null;

export function initToasts(parent: HTMLElement): void {
  host = document.createElement('div');
  host.className = 'toast-host';
  parent.appendChild(host);
}

export type ToastKind = 'info' | 'good' | 'bad';

/** Short message pill near the top of the screen; fades after ~2.4 s. */
export function toast(message: string, kind: ToastKind = 'info'): void {
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  host.appendChild(el);
  while (host.children.length > 3) host.firstElementChild?.remove();
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2600);
}
