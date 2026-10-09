/** Cat breeds, coats, rarities, personalities and names. All tunable here. */

export type CoatPattern = 'solid' | 'tabby' | 'pointed' | 'calico' | 'tuxedo' | 'tortie';
export type EarType = 'normal' | 'big' | 'small' | 'folded' | 'tufted';
export type MuzzleType = 'normal' | 'flat' | 'long';

export interface CoatVariant {
  name: string;
  pattern: CoatPattern;
  base: string;
  /** Stripes / points / second patch colour. */
  dark: string;
  /** Third colour (calico orange patches). */
  accent?: string;
  /** 0 = none, 0.3 = muzzle/chest, 0.6 = + belly/paws, 0.9 = tuxedo. */
  white: number;
}

export interface BreedDef {
  id: string;
  name: string;
  /** Adoption base value before rarity / happiness / villa multipliers. */
  baseValue: number;
  coats: CoatVariant[];
  eyeColors: string[];
  size: [number, number];
  /** 0 sleek .. 1 very fluffy. */
  fluff: number;
  ears: EarType;
  muzzle: MuzzleType;
  /** Body slenderness: <1 slim, >1 chunky. */
  build: number;
  /** Rarity floor for this breed. */
  minRarity: Rarity;
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

export const RARITIES: Record<Rarity, { label: string; color: string; weight: number; priceMult: number }> = {
  common: { label: 'Common', color: '#9aa5b1', weight: 60, priceMult: 1 },
  uncommon: { label: 'Uncommon', color: '#4fbf7f', weight: 25, priceMult: 1.6 },
  rare: { label: 'Rare', color: '#4f9dff', weight: 12, priceMult: 2.6 },
  legendary: { label: 'Legendary', color: '#f2a93b', weight: 3, priceMult: 4.5 },
};

export type Personality = 'Playful' | 'Sleepy' | 'Curious' | 'Shy';
export const PERSONALITIES: Personality[] = ['Playful', 'Sleepy', 'Curious', 'Shy'];

const EYES = {
  green: '#8fd16a',
  yellow: '#ffd23f',
  amber: '#f2a23a',
  copper: '#e0803a',
  blue: '#5fb4ff',
  iceBlue: '#9fd8ff',
  hazel: '#b8a24a',
};

export const BREEDS: BreedDef[] = [
  {
    id: 'shorthair',
    name: 'Domestic Shorthair',
    baseValue: 80,
    coats: [
      { name: 'Grey Tabby', pattern: 'tabby', base: '#a3a4ad', dark: '#5f606c', white: 0.3 },
      { name: 'Brown Tabby', pattern: 'tabby', base: '#b08d6c', dark: '#5e4532', white: 0.3 },
      { name: 'Smoke Grey', pattern: 'solid', base: '#8d909c', dark: '#6b6e7a', white: 0 },
      { name: 'Grey & White', pattern: 'solid', base: '#8f939f', dark: '#70737e', white: 0.65 },
    ],
    eyeColors: [EYES.green, EYES.yellow, EYES.amber, EYES.hazel],
    size: [0.95, 1.05],
    fluff: 0.12,
    ears: 'normal',
    muzzle: 'normal',
    build: 1,
    minRarity: 'common',
  },
  {
    id: 'persian',
    name: 'Fluffy Persian',
    baseValue: 220,
    coats: [
      { name: 'Snow White', pattern: 'solid', base: '#f6f2ec', dark: '#e4ddd3', white: 0 },
      { name: 'Cream', pattern: 'solid', base: '#f3dcb8', dark: '#e2c296', white: 0.3 },
      { name: 'Silver', pattern: 'tabby', base: '#dadbe2', dark: '#a9abb8', white: 0.3 },
      { name: 'Blue', pattern: 'solid', base: '#a3abbf', dark: '#8a92a6', white: 0 },
    ],
    eyeColors: [EYES.copper, EYES.blue, EYES.green],
    size: [1.0, 1.1],
    fluff: 1,
    ears: 'small',
    muzzle: 'flat',
    build: 1.12,
    minRarity: 'common',
  },
  {
    id: 'siamese',
    name: 'Siamese',
    baseValue: 160,
    coats: [
      { name: 'Seal Point', pattern: 'pointed', base: '#f2e5cf', dark: '#4a3a33', white: 0 },
      { name: 'Blue Point', pattern: 'pointed', base: '#eef0f3', dark: '#6f7a92', white: 0 },
      { name: 'Chocolate Point', pattern: 'pointed', base: '#f5eadb', dark: '#7a5644', white: 0 },
    ],
    eyeColors: [EYES.blue, EYES.iceBlue],
    size: [0.92, 1.0],
    fluff: 0,
    ears: 'big',
    muzzle: 'long',
    build: 0.88,
    minRarity: 'common',
  },
  {
    id: 'orange-tabby',
    name: 'Orange Tabby',
    baseValue: 90,
    coats: [
      { name: 'Ginger', pattern: 'tabby', base: '#f3a457', dark: '#cc6a2c', white: 0.3 },
      { name: 'Ginger & White', pattern: 'tabby', base: '#f3a457', dark: '#cc6a2c', white: 0.65 },
      { name: 'Cream Tabby', pattern: 'tabby', base: '#f6cf9a', dark: '#dc9f5c', white: 0.3 },
    ],
    eyeColors: [EYES.amber, EYES.green, EYES.yellow],
    size: [0.98, 1.1],
    fluff: 0.15,
    ears: 'normal',
    muzzle: 'normal',
    build: 1.08,
    minRarity: 'common',
  },
  {
    id: 'black',
    name: 'Black Cat',
    baseValue: 100,
    coats: [{ name: 'Midnight', pattern: 'solid', base: '#2f2d38', dark: '#24222b', white: 0 }],
    eyeColors: [EYES.yellow, EYES.green, EYES.amber],
    size: [0.94, 1.04],
    fluff: 0.1,
    ears: 'normal',
    muzzle: 'normal',
    build: 0.96,
    minRarity: 'common',
  },
  {
    id: 'calico',
    name: 'Calico',
    baseValue: 140,
    coats: [
      { name: 'Calico', pattern: 'calico', base: '#fbf7f0', dark: '#34303a', accent: '#ea9348', white: 0.6 },
      { name: 'Dilute Calico', pattern: 'calico', base: '#fbf7f0', dark: '#8f94a6', accent: '#f1c18e', white: 0.6 },
    ],
    eyeColors: [EYES.green, EYES.amber, EYES.yellow],
    size: [0.92, 1.02],
    fluff: 0.15,
    ears: 'normal',
    muzzle: 'normal',
    build: 0.98,
    minRarity: 'common',
  },
  {
    id: 'tuxedo',
    name: 'Tuxedo',
    baseValue: 110,
    coats: [{ name: 'Tuxedo', pattern: 'tuxedo', base: '#2f2d38', dark: '#24222b', white: 0.9 }],
    eyeColors: [EYES.green, EYES.yellow],
    size: [0.95, 1.05],
    fluff: 0.12,
    ears: 'normal',
    muzzle: 'normal',
    build: 1,
    minRarity: 'common',
  },
  {
    id: 'maine-coon',
    name: 'Maine Coon',
    baseValue: 260,
    coats: [
      { name: 'Brown Tabby', pattern: 'tabby', base: '#a5835f', dark: '#4f3a29', white: 0.3 },
      { name: 'Silver Tabby', pattern: 'tabby', base: '#c9cad2', dark: '#6b6d79', white: 0.3 },
    ],
    eyeColors: [EYES.green, EYES.amber, EYES.copper],
    size: [1.12, 1.22],
    fluff: 0.75,
    ears: 'tufted',
    muzzle: 'normal',
    build: 1.1,
    minRarity: 'uncommon',
  },
  {
    id: 'ragdoll',
    name: 'Ragdoll',
    baseValue: 280,
    coats: [
      { name: 'Seal Mitted', pattern: 'pointed', base: '#f6efe4', dark: '#7d6656', white: 0.6 },
      { name: 'Blue Colorpoint', pattern: 'pointed', base: '#f1f2f5', dark: '#8893aa', white: 0 },
    ],
    eyeColors: [EYES.blue, EYES.iceBlue],
    size: [1.05, 1.15],
    fluff: 0.85,
    ears: 'normal',
    muzzle: 'normal',
    build: 1.05,
    minRarity: 'uncommon',
  },
  {
    id: 'scottish-fold',
    name: 'Scottish Fold',
    baseValue: 300,
    coats: [
      { name: 'Blue', pattern: 'solid', base: '#a1a9bb', dark: '#848ca0', white: 0 },
      { name: 'Cream Tabby', pattern: 'tabby', base: '#f2d8b4', dark: '#d5a874', white: 0.3 },
      { name: 'Tortoiseshell', pattern: 'tortie', base: '#3a2f2c', dark: '#2a2224', accent: '#d9813f', white: 0 },
    ],
    eyeColors: [EYES.copper, EYES.amber, EYES.yellow],
    size: [0.94, 1.02],
    fluff: 0.3,
    ears: 'folded',
    muzzle: 'normal',
    build: 1.08,
    minRarity: 'rare',
  },
];

export const BREED_BY_ID: Record<string, BreedDef> = Object.fromEntries(BREEDS.map((b) => [b.id, b]));

/** How likely each personality is to pick an activity (relative weights). */
export const PERSONALITY_ACTIVITY: Record<Personality, Partial<Record<CatActivityId, number>>> = {
  Playful: { play: 4, walk: 2, idle: 2, sit: 1, groom: 1, sleep: 1, eat: 1 },
  Sleepy: { sleep: 5, sit: 2, groom: 2, idle: 1, eat: 1, walk: 0.5 },
  Curious: { walk: 4, idle: 3, sit: 1, play: 1.5, eat: 1, groom: 1 },
  Shy: { sit: 3, groom: 2.5, sleep: 2, idle: 2, walk: 1 },
};

export type CatActivityId = 'idle' | 'sit' | 'sleep' | 'stretch' | 'walk' | 'play' | 'eat' | 'groom';

export const CAT_NAMES = [
  'Mochi', 'Biscuit', 'Pudding', 'Luna', 'Miso', 'Tofu', 'Pumpkin', 'Cookie', 'Peaches', 'Nala',
  'Oreo', 'Pepper', 'Ginger', 'Maple', 'Waffles', 'Bean', 'Noodle', 'Sushi', 'Boba', 'Kiwi',
  'Honey', 'Latte', 'Muffin', 'Pixel', 'Clover', 'Daisy', 'Sesame', 'Tiger', 'Smudge', 'Socks',
  'Nugget', 'Marble', 'Cinnamon', 'Juniper', 'Olive', 'Pebble', 'Willow', 'Toffee', 'Dumpling', 'Caramel',
  'Snowball', 'Shadow', 'Comet', 'Hazel', 'Poppy', 'Sprout', 'Truffle', 'Mango', 'Coco', 'Butter',
  'Mittens', 'Whiskers', 'Ziggy', 'Bubbles', 'Cupcake', 'Fig', 'Sunny', 'Misty', 'Bao', 'Yuzu',
];

export const MEOW_LINES = ['Meow!', 'Mew~', 'Mrrp?', 'Purr…', 'Nyaa!', 'Mrow!'];
