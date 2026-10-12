import type { CatData } from '../game/cat-data';
import type { PendingOrder } from '../game/orders';

const KEY = 'lb-save-v1';

export interface SaveData {
  v: 1;
  money: number;
  xp: number;
  prices: Record<string, number>;
  shelfUnits?: string[];
  shelves: Array<{ id: string; productId: string; count: number }>;
  villas: Array<{ id: string; unlocked: boolean; cat: CatData | null }>;
  boxes: Array<{ productId: string; count: number }>;
  orders: PendingOrder[];
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    return data && data.v === 1 && typeof data.money === 'number' ? data : null;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage full or blocked: the shop just won't persist
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
