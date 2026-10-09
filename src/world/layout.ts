/**
 * Store dimensions in metres. The store is a "dollhouse" room: back wall at
 * -Z, right wall at +X, storefront (window + door) on the left wall at -X,
 * and only a low rim at +Z so the follow camera can look in.
 */
export const STORE = {
  minX: -8,
  maxX: 8,
  minZ: -6,
  maxZ: 6,
  wallHeight: 3.2,
  wallThickness: 0.3,
  wainscotHeight: 1.05,
  frontRimHeight: 0.45,
} as const;

/** Big shop window on the left wall (z range, y range). */
export const SHOP_WINDOW = { zMin: -4.6, zMax: 1.2, sill: 0.55, top: 2.65 } as const;

/** Entrance door on the left wall. */
export const DOOR = { zMin: 2.2, zMax: 4.2, height: 2.55 } as const;

/** Corner plants: [x, z, scale, leaf colour]. Also used for collisions. */
export const PLANT_SPOTS: ReadonlyArray<readonly [number, number, number, string]> = [
  [STORE.minX + 0.55, STORE.minZ + 0.55, 1.25, '#7fcf9c'],
  [STORE.maxX - 0.55, STORE.minZ + 0.55, 1.1, '#92d9a8'],
  [STORE.maxX - 0.55, STORE.maxZ - 0.6, 1.0, '#7fcf9c'],
  [STORE.minX + 0.5, 5.2, 0.85, '#a5dfb4'],
];

/** Where the player starts each session. */
export const PLAYER_START = { x: 0, z: 2.5 } as const;

export const PALETTE = {
  cream: '#fff4e2',
  creamTop: '#fffaf1',
  mint: '#9fdcc8',
  mintDark: '#7cc7b0',
  trim: '#ffffff',
  wood: '#d9a877',
  woodDark: '#b9845a',
  ink: '#3b3a4a',
  pink: '#ff8fab',
  sidewalk: '#d9d4cc',
} as const;
