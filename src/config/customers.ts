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
