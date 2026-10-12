/** Shop products. All numbers are tunable here; fictional brands only. */

export type ProductCategory = 'food' | 'litter' | 'toys' | 'beds' | 'accessories';

export type ProductKind =
  | 'bag'
  | 'pouch'
  | 'can'
  | 'tube'
  | 'bucket'
  | 'box'
  | 'wand'
  | 'mouse'
  | 'yarn'
  | 'cushion'
  | 'cave'
  | 'scratcher'
  | 'collar';

export interface ProductDef {
  id: string;
  name: string;
  /** Short descriptor shown under the name. */
  sub: string;
  category: ProductCategory;
  kind: ProductKind;
  /** Main pack colour and accent (text / trim). */
  color: string;
  accent: string;
  /** Market cost per unit (what the shop pays). */
  cost: number;
  /** Suggested shelf price per unit. */
  price: number;
  /** Units per delivery box. */
  boxSize: number;
  /** Level that unlocks ordering (enforced from M7). */
  unlockLevel: number;
  /** Item size in metres [width, height, depth]; front faces +Z. */
  size: readonly [number, number, number];
  /** Items that can be stacked on top of each other in a shelf slot. */
  layers: number;
  /** Emoji used in UI lists. */
  icon: string;
}

export const CATEGORIES: Array<{ id: ProductCategory; label: string; icon: string }> = [
  { id: 'food', label: 'Food', icon: '🐟' },
  { id: 'litter', label: 'Litter', icon: '🪣' },
  { id: 'toys', label: 'Toys', icon: '🧶' },
  { id: 'beds', label: 'Beds', icon: '🛏️' },
  { id: 'accessories', label: 'Accessories', icon: '🎀' },
];

export const PRODUCTS: ProductDef[] = [
  {
    id: 'whisker-crunch', name: 'Whisker Crunch', sub: 'Dry food', category: 'food', kind: 'bag',
    color: '#f4a259', accent: '#7a4b1e', cost: 6, price: 9, boxSize: 6, unlockLevel: 1,
    size: [0.2, 0.3, 0.09], layers: 1, icon: '🥣',
  },
  {
    id: 'kitten-crunch', name: 'Kitten Crunch', sub: 'Kitten dry food', category: 'food', kind: 'bag',
    color: '#ffb3c7', accent: '#a83e63', cost: 7, price: 10, boxSize: 6, unlockLevel: 2,
    size: [0.17, 0.25, 0.08], layers: 1, icon: '🍼',
  },
  {
    id: 'purr-pouch', name: 'Purr Pouch', sub: 'Wet food', category: 'food', kind: 'pouch',
    color: '#8fd1c2', accent: '#2a6f60', cost: 2, price: 3, boxSize: 12, unlockLevel: 1,
    size: [0.12, 0.17, 0.035], layers: 1, icon: '🥫',
  },
  {
    id: 'tuna-tidbits', name: 'Tuna Tidbits', sub: 'Tuna can', category: 'food', kind: 'can',
    color: '#7fb7ff', accent: '#244f94', cost: 2, price: 3, boxSize: 12, unlockLevel: 1,
    size: [0.08, 0.1, 0.08], layers: 2, icon: '🐟',
  },
  {
    id: 'crunchy-treats', name: 'Crunchy Treats', sub: 'Cat treats', category: 'food', kind: 'tube',
    color: '#ffd166', accent: '#8a5a00', cost: 3, price: 5, boxSize: 8, unlockLevel: 2,
    size: [0.07, 0.17, 0.07], layers: 1, icon: '🍪',
  },
  {
    id: 'cloud-litter', name: 'Cloud Litter', sub: 'Clumping litter', category: 'litter', kind: 'bucket',
    color: '#b9c6ff', accent: '#3d4ab0', cost: 11, price: 16, boxSize: 4, unlockLevel: 1,
    size: [0.17, 0.22, 0.17], layers: 1, icon: '🪣',
  },
  {
    id: 'cloud-litter-lite', name: 'Cloud Litter Lite', sub: 'Pine pellets', category: 'litter', kind: 'box',
    color: '#d6c3ff', accent: '#5a3a9f', cost: 8, price: 12, boxSize: 6, unlockLevel: 1,
    size: [0.2, 0.22, 0.1], layers: 1, icon: '🌲',
  },
  {
    id: 'feather-wand', name: 'Feather Wand', sub: 'Feather Wand Co.', category: 'toys', kind: 'wand',
    color: '#ff8fab', accent: '#b01a52', cost: 4, price: 7, boxSize: 8, unlockLevel: 1,
    size: [0.1, 0.42, 0.06], layers: 1, icon: '🪶',
  },
  {
    id: 'jingle-mouse', name: 'Jingle Mouse', sub: 'Feather Wand Co.', category: 'toys', kind: 'mouse',
    color: '#c9c2e6', accent: '#5f5a7a', cost: 3, price: 5, boxSize: 10, unlockLevel: 1,
    size: [0.1, 0.06, 0.12], layers: 2, icon: '🐭',
  },
  {
    id: 'yarn-trio', name: 'Yarn Trio', sub: 'Feather Wand Co.', category: 'toys', kind: 'yarn',
    color: '#9fe0b8', accent: '#2a7a50', cost: 3, price: 5, boxSize: 8, unlockLevel: 2,
    size: [0.18, 0.1, 0.18], layers: 2, icon: '🧶',
  },
  {
    id: 'cozy-cushion', name: 'Cozy Cushion', sub: 'Snooze Cat Beds', category: 'beds', kind: 'cushion',
    color: '#ffcf9f', accent: '#b45f17', cost: 18, price: 27, boxSize: 3, unlockLevel: 1,
    size: [0.34, 0.1, 0.34], layers: 3, icon: '🛏️',
  },
  {
    id: 'snooze-cave', name: 'Snooze Cave', sub: 'Snooze Cat Beds', category: 'beds', kind: 'cave',
    color: '#b3d4ff', accent: '#2f64a8', cost: 26, price: 40, boxSize: 2, unlockLevel: 3,
    size: [0.36, 0.3, 0.34], layers: 1, icon: '🏠',
  },
  {
    id: 'scratch-board', name: 'Scratch Board', sub: 'Scratch & Purr', category: 'accessories', kind: 'scratcher',
    color: '#e8c49a', accent: '#7a4c20', cost: 9, price: 14, boxSize: 4, unlockLevel: 1,
    size: [0.3, 0.42, 0.06], layers: 1, icon: '🪵',
  },
  {
    id: 'bell-collar', name: 'Bell Collar', sub: 'Scratch & Purr', category: 'accessories', kind: 'collar',
    color: '#ff6f91', accent: '#9a1a45', cost: 5, price: 8, boxSize: 10, unlockLevel: 2,
    size: [0.1, 0.14, 0.03], layers: 1, icon: '🔔',
  },
];

export const PRODUCT_BY_ID: Record<string, ProductDef> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export function boxCost(p: ProductDef): number {
  return p.cost * p.boxSize;
}

/** Suggested prices as shipped; the live `price` can be changed from the tablet. */
export const DEFAULT_PRICE: Record<string, number> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p.price]));
