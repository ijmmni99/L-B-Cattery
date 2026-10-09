import { detectDefaultQuality, type QualityLevel } from './quality';

export interface Settings {
  quality: QualityLevel;
  /** Look speed multiplier, 0.3..2.0. */
  lookSensitivity: number;
  headBob: boolean;
  haptics: boolean;
}

const STORAGE_KEY = 'lb-settings';

function defaults(): Settings {
  return { quality: detectDefaultQuality(), lookSensitivity: 1, headBob: false, haptics: true };
}

function load(): Settings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      quality: parsed.quality === 'low' || parsed.quality === 'medium' || parsed.quality === 'high' ? parsed.quality : base.quality,
      lookSensitivity:
        typeof parsed.lookSensitivity === 'number' ? Math.min(Math.max(parsed.lookSensitivity, 0.3), 2) : base.lookSensitivity,
      headBob: typeof parsed.headBob === 'boolean' ? parsed.headBob : base.headBob,
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : base.haptics,
    };
  } catch {
    return base;
  }
}

const current: Settings = load();
const listeners: Array<(s: Readonly<Settings>) => void> = [];

export function getSettings(): Readonly<Settings> {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(current, patch);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // storage unavailable: settings last for this session only
  }
  for (const fn of listeners) fn(current);
}

export function onSettingsChange(fn: (s: Readonly<Settings>) => void): void {
  listeners.push(fn);
}
