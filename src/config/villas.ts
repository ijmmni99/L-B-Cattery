/** Villa spots in the shop. `unlockCost` 0 = open from the start. All tunable here. */
export interface VillaSpot {
  id: string;
  x: number;
  z: number;
  unlockCost: number;
  /** Trim colour so neighbouring villas read as different. */
  tint: string;
}

export const VILLA_SIZE = { w: 2.0, d: 1.7, platform: 0.12 } as const;

export const VILLA_SPOTS: VillaSpot[] = [
  { id: 'villa-1', x: -3.6, z: -2.5, unlockCost: 0, tint: '#9fdcc8' },
  { id: 'villa-2', x: 0, z: -2.5, unlockCost: 0, tint: '#ffc2cf' },
  { id: 'villa-3', x: 3.6, z: -2.5, unlockCost: 150, tint: '#ffe08a' },
  { id: 'villa-4', x: -3.6, z: 0.7, unlockCost: 250, tint: '#d6c3ff' },
  { id: 'villa-5', x: 0, z: 0.7, unlockCost: 350, tint: '#b3d4ff' },
  { id: 'villa-6', x: 3.6, z: 0.7, unlockCost: 500, tint: '#ffcf9f' },
];

/** What the shelter charges relative to a cat's adoption value (breed value x rarity). */
export const CAT_PRICE_FACTOR = 0.5;
/** Cost of rolling a fresh set of cats at the shelter. */
export const REROLL_COST = 10;
export const OFFERS_PER_ROLL = 3;
