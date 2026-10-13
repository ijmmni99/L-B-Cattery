/** Customer tuning (all seconds / counts). */
export const CUSTOMERS = {
  maxInStore: 4,
  /** First customer arrives after this long, then every min..max seconds. */
  firstDelay: 6,
  spawnMin: 12,
  spawnMax: 22,
  walkSpeed: 1.5,
  /** Chance that a visitor comes to adopt a cat (when one is available). */
  adoptChance: 0.3,
  /** Shelf visits per customer. */
  minWishes: 1,
  maxWishes: 3,
  browseMin: 1.0,
  browseMax: 2.0,
  /** How long the head of the queue waits for the player to check them out. */
  patience: 45,
  impatientBelow: 15,
} as const;

export type CustomerKind = 'regular' | 'vip' | 'kid' | 'picky';

/** Customer types: arrival odds (rolled in order) and what makes each different. */
export const KINDS = {
  vip: { chance: 0.12, priceMult: 1.25, patience: 30, minCleanliness: 0.8, badge: '👑', title: 'VIP customer' },
  kid: { chance: 0.15, priceMult: 1, patience: 35, speedMult: 1.25, scale: 0.78, badge: '🧸', title: 'Kid' },
  picky: { chance: 0.15, priceMult: 1.15, patience: 45, badge: '🔍', title: 'Picky adopter' },
} as const;
