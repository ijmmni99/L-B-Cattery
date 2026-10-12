export type { VillaSpot } from './build';

export const VILLA_SIZE = { w: 2.0, d: 1.7, platform: 0.12 } as const;

/** Trim colours handed out to villas in turn so neighbours read as different. */
export const VILLA_TINTS = ['#9fdcc8', '#ffc2cf', '#ffe08a', '#d6c3ff', '#b3d4ff', '#ffcf9f'];

/** What the shelter charges relative to a cat's adoption value (breed value x rarity). */
export const CAT_PRICE_FACTOR = 0.5;
/** Cost of rolling a fresh set of cats at the shelter. */
export const REROLL_COST = 10;
export const OFFERS_PER_ROLL = 3;
