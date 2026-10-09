import {
  BREEDS,
  BREED_BY_ID,
  CAT_NAMES,
  PERSONALITIES,
  RARITIES,
  RARITY_ORDER,
  type BreedDef,
  type Personality,
  type Rarity,
} from '../config/cats';
import { mulberry32 } from '../core/noise';

/** Everything needed to rebuild a cat's look (saved with the cat). */
export interface CatAppearance {
  breedId: string;
  coatIndex: number;
  eyeLeft: string;
  eyeRight: string;
  size: number;
  /** Pattern noise seed. */
  seed: number;
}

export interface CatData {
  id: string;
  name: string;
  personality: Personality;
  rarity: Rarity;
  appearance: CatAppearance;
}

let counter = 0;

function pickWeighted<T extends string>(weights: Array<[T, number]>, rand: () => number): T {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of weights) {
    r -= w;
    if (r <= 0) return k;
  }
  return weights[weights.length - 1][0];
}

export function rollRarity(rand: () => number, maxRarity: Rarity = 'legendary', floor: Rarity = 'common'): Rarity {
  const lo = RARITY_ORDER.indexOf(floor);
  const hi = RARITY_ORDER.indexOf(maxRarity);
  const options = RARITY_ORDER.filter((_, i) => i >= lo && i <= Math.max(hi, lo));
  return pickWeighted(options.map((r) => [r, RARITIES[r].weight] as [Rarity, number]), rand);
}

/**
 * Creates a random cat. `breedId` forces a breed; `maxRarity` caps the roll
 * (unlocks by level later). Legendary cats may get odd-coloured eyes.
 */
export function generateCat(opts: { seed?: number; breedId?: string; maxRarity?: Rarity } = {}): CatData {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rand = mulberry32(seed);
  const breed: BreedDef = (opts.breedId && BREED_BY_ID[opts.breedId]) || BREEDS[Math.floor(rand() * BREEDS.length)];
  const rarity = rollRarity(rand, opts.maxRarity ?? 'legendary', breed.minRarity);
  const eye = breed.eyeColors[Math.floor(rand() * breed.eyeColors.length)];
  let eyeRight = eye;
  if (rarity === 'legendary' && rand() < 0.6) {
    const others = ['#5fb4ff', '#ffd23f', '#8fd16a', '#e0803a'].filter((c) => c !== eye);
    eyeRight = others[Math.floor(rand() * others.length)];
  }
  const [smin, smax] = breed.size;
  counter++;
  return {
    id: `cat-${seed.toString(36)}-${counter}`,
    name: CAT_NAMES[Math.floor(rand() * CAT_NAMES.length)],
    personality: PERSONALITIES[Math.floor(rand() * PERSONALITIES.length)],
    rarity,
    appearance: {
      breedId: breed.id,
      coatIndex: Math.floor(rand() * breed.coats.length),
      eyeLeft: eye,
      eyeRight,
      size: smin + rand() * (smax - smin),
      seed: Math.floor(rand() * 100000),
    },
  };
}
