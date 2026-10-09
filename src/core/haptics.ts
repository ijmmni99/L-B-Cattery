import { getSettings } from './settings';

/** Short vibration on key actions; silently ignored where unsupported (iOS). */
export function haptic(pattern: number | number[] = 15): void {
  if (!getSettings().haptics || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // some browsers throw without a user gesture
  }
}
