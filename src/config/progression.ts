import type { Rarity } from './cats';

/** Total XP needed to reach each level (index 0 = level 1). */
export const LEVEL_XP = [0, 40, 110, 220, 380, 600, 900, 1300, 1800, 2500];
export const MAX_LEVEL = LEVEL_XP.length;

/** Cash reward on reaching a level. */
export const levelUpBonus = (level: number): number => level * 40;

/** Rarest cat the shelter can offer at a level. */
export function maxRarityFor(level: number): Rarity {
  if (level >= 8) return 'legendary';
  if (level >= 5) return 'rare';
  if (level >= 3) return 'uncommon';
  return 'common';
}

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) level = i + 1;
  return level;
}

/** XP earned for a sale of `amount` dollars. */
export const xpForSale = (amount: number): number => Math.round(amount * 0.4) + 3;
export const XP_ADOPTION = 25;

/** Customers accept up to this multiple of the suggested price, then stop buying by this one. */
export const PRICE_OK = 1.15;
export const PRICE_LIMIT = 1.8;
export const PRICE_MIN_FACTOR = 0.5;
export const PRICE_MAX_FACTOR = 2.5;

/** Adoption fee relative to a cat's value (breed value x rarity). */
export const ADOPTION_FACTOR = 1.1;
