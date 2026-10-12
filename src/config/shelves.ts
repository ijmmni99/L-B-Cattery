/** Shelf unit types. Slots hold one product each. */
export interface ShelfTypeDef {
  id: string;
  name: string;
  tiers: number;
  slotsPerTier: number;
  /** Clear height between boards (max product height). */
  clearHeight: number;
  /** Slot size (metres). */
  slotW: number;
  slotD: number;
  /** Price to buy another one (shop expansion, M7). */
  cost: number;
}

export const SHELF_TYPES: Record<string, ShelfTypeDef> = {
  gondola: { id: 'gondola', name: 'Gondola Shelf', tiers: 4, slotsPerTier: 3, clearHeight: 0.36, slotW: 0.46, slotD: 0.4, cost: 150 },
  bench: { id: 'bench', name: 'Low Bench', tiers: 2, slotsPerTier: 3, clearHeight: 0.52, slotW: 0.46, slotD: 0.5, cost: 120 },
};

/** Gap between neighbouring items in a slot. */
export const ITEM_GAP = 0.012;
/** Hard cap on items per slot, so one slot can't dominate instance memory. */
export const SLOT_MAX_ITEMS = 30;

export const BOARD_THICKNESS = 0.03;
export const PLINTH = 0.1;
export const SIDE_THICKNESS = 0.04;
export const BACK_THICKNESS = 0.03;
