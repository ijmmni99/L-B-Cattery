import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker (offline support). When a new version is ready
 * it offers a reload instead of reloading under the player. No-op in dev.
 */
export function setupPwa(onBeforeReload: () => void, parent: HTMLElement): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'update-toast';
      btn.textContent = 'Update ready · tap to restart';
      btn.addEventListener('click', () => {
        onBeforeReload();
        void update(true);
      });
      parent.appendChild(btn);
    },
  });
}
