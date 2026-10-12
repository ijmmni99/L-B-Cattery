import { LEGACY_SHELVES, LEGACY_VILLAS, START_SHELVES, START_VILLAS, VILLA_BASE_COST } from '../config/build';
import { SHELF_TYPES } from '../config/shelves';
import type { CatData } from '../game/cat-data';
import type { ShelfSpot, VillaSpot } from '../config/build';
import type { PendingOrder } from '../game/orders';

const KEY = 'lb-save-v1';

export interface SaveData {
  v: 1;
  money: number;
  xp: number;
  prices: Record<string, number>;
  /** Legacy (pre build mode): ids of owned fixed shelf spots. */
  shelfUnits?: string[];
  layout?: { shelves: ShelfSpot[]; villas: VillaSpot[] };
  shelves: Array<{ id: string; productId: string; count: number }>;
  villas: Array<{ id: string; unlocked?: boolean; cat: CatData | null }>;
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

/** The shop layout to build: from a save, converted from an old fixed-spot save, or the starting one. */
export function resolveLayout(saved: SaveData | null): { shelves: ShelfSpot[]; villas: VillaSpot[] } {
  if (saved?.layout) return saved.layout;
  if (!saved) return { shelves: START_SHELVES.map((s) => ({ ...s })), villas: START_VILLAS.map((v) => ({ ...v })) };
  // Old save: every shelf/villa it mentions sits where the fixed spot used to be.
  const shelfIds = new Set([...(saved.shelfUnits ?? Object.keys(LEGACY_SHELVES)), ...saved.shelves.map((s) => s.id.split(':')[0])]);
  const shelves: ShelfSpot[] = [];
  for (const id of shelfIds) {
    const spot = LEGACY_SHELVES[id];
    if (spot) shelves.push({ id, ...spot, paid: SHELF_TYPES[spot.type].cost });
  }
  const villas: VillaSpot[] = [];
  for (const v of saved.villas) {
    const spot = LEGACY_VILLAS[v.id];
    if (spot && (v.unlocked ?? true)) villas.push({ id: v.id, ...spot, yaw: 0, paid: VILLA_BASE_COST });
  }
  return { shelves, villas };
}
