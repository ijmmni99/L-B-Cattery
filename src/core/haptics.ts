const STORAGE_KEY = 'lb-haptics';

let enabled = readSetting();

function readSetting(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function hapticsEnabled(): boolean {
  return enabled;
}

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // preference won't persist
  }
}

/** Short vibration on key actions; silently ignored where unsupported (iOS). */
export function haptic(pattern: number | number[] = 15): void {
  if (!enabled || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // some browsers throw without a user gesture
  }
}
