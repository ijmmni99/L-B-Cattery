import { registerSW } from 'virtual:pwa-register';

/** Registers the service worker (offline support). No-op in dev. */
export function setupPwa(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
