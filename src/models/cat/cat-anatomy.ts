import type { BreedDef } from '../../config/cats';

export type V3 = [number, number, number];

/**
 * Rest-pose proportions in model space (metres, before the per-cat size
 * scale). The cat faces +Z, stands on y = 0. Chibi proportions: big head,
 * short legs.
 */
export interface CatDims {
  bodyR: number;
  bodyLen: number;
  /** Height of the body centre line. */
  bodyY: number;
  headR: number;
  hips: V3;
  chest: V3;
  head: V3;
  legFront: V3;
  legBack: V3;
  frontLegLen: number;
  backLegLen: number;
  tailBase: V3;
  tailSegLen: number;
  tailSegs: number;
  tailRadius: [number, number];
  /** Rest tail pitch around X (negative = leaning back). */
  tailPitch: number;
}

export function catDims(breed: BreedDef): CatDims {
  const b = breed.build;
  const bodyR = 0.082 * b;
  const bodyLen = 0.15 * (breed.id === 'siamese' ? 1.12 : 1);
  const bodyY = 0.15;
  const headR = breed.muzzle === 'flat' ? 0.106 : 0.1;
  const half = bodyLen / 2;
  const fluffyTail = breed.fluff > 0.5;
  return {
    bodyR,
    bodyLen,
    bodyY,
    headR,
    hips: [0, bodyY, -half * 0.75],
    chest: [0, bodyY, half * 0.75],
    head: [0, bodyY + 0.105, half + 0.075],
    legFront: [0.046 * b, bodyY - 0.02, half * 0.85],
    legBack: [0.05 * b, bodyY - 0.01, -half * 0.8],
    frontLegLen: bodyY - 0.02,
    backLegLen: bodyY - 0.01,
    tailBase: [0, bodyY + bodyR * 0.45, -half - bodyR * 0.85],
    tailSegLen: 0.034,
    tailSegs: 6,
    tailRadius: fluffyTail ? [0.036, 0.028] : [0.025, 0.017],
    tailPitch: -0.95,
  };
}
