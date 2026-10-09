export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityProfile {
  level: QualityLevel;
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: number;
  bloom: boolean;
  antialias: boolean;
  maxCustomers: number;
  maxCats: number;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  low: {
    level: 'low',
    pixelRatioCap: 1.5,
    shadows: false,
    shadowMapSize: 512,
    bloom: false,
    antialias: false,
    maxCustomers: 6,
    maxCats: 6,
  },
  medium: {
    level: 'medium',
    pixelRatioCap: 2,
    shadows: true,
    shadowMapSize: 1024,
    bloom: false,
    antialias: true,
    maxCustomers: 9,
    maxCats: 8,
  },
  high: {
    level: 'high',
    pixelRatioCap: 2,
    shadows: true,
    shadowMapSize: 2048,
    bloom: true,
    antialias: true,
    maxCustomers: 12,
    maxCats: 10,
  },
};

const STORAGE_KEY = 'lb-quality';

/** Rough device-tier guess; the player can override in Settings. */
export function detectDefaultQuality(): QualityLevel {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(nav.userAgent);
  if (cores <= 4 || memory <= 3) return 'low';
  if (isMobile) return 'medium';
  return 'high';
}

export function loadQuality(): QualityLevel {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'low' || stored === 'medium' || stored === 'high') return stored;
  } catch {
    // storage unavailable (private mode); fall through to detection
  }
  return detectDefaultQuality();
}

export function saveQuality(level: QualityLevel): void {
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch {
    // ignore: preference simply won't persist
  }
}
