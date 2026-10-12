import { SHELF_TYPES } from './shelves';

export type BuildKind = 'gondola' | 'bench' | 'villa';

/** A shelf unit in the shop. `paid` = what it cost (refunds are a share of it). */
export interface ShelfSpot {
  id: string;
  type: 'gondola' | 'bench';
  x: number;
  z: number;
  /** Rotation about Y; the unit's front faces local +Z. */
  yaw: number;
  paid: number;
}

export interface VillaSpot {
  id: string;
  x: number;
  z: number;
  yaw: number;
  paid: number;
}

export const MAX_SHELVES = 16;
export const MAX_VILLAS = 8;

/** Selling gives back this share of what was paid. */
export const SELL_REFUND = 0.6;

/** First villa price; each extra villa costs more, so cats are a long-term goal. */
export const VILLA_BASE_COST = 700;
export const VILLA_GROWTH = 1.5;

export const BUILD_LABEL: Record<BuildKind, { name: string; icon: string }> = {
  gondola: { name: 'Shelf', icon: '🗄️' },
  bench: { name: 'Bench', icon: '🪑' },
  villa: { name: 'Villa', icon: '🏠' },
};

/** What the next unit of a kind costs, given how many villas are already owned. */
export function buildCost(kind: BuildKind, villasOwned: number): number {
  if (kind === 'villa') return Math.round((VILLA_BASE_COST * VILLA_GROWTH ** Math.max(0, villasOwned - 1)) / 10) * 10;
  return SHELF_TYPES[kind].cost;
}

/** Grid the build ghost snaps to (metres), and how close to a wall it snaps flush. */
export const BUILD_GRID = 0.05;
export const WALL_SNAP = 1.0;
/** Free floor needed in front of a unit so customers can reach it. */
export const FRONT_CLEARANCE = 0.6;

/** Shop layout a new game starts with. */
export const START_SHELVES: ShelfSpot[] = [
  { id: 'shelf-a', type: 'gondola', x: -6.6, z: -5.75, yaw: 0, paid: 150 },
  { id: 'shelf-b', type: 'gondola', x: -5.05, z: -5.75, yaw: 0, paid: 150 },
  { id: 'shelf-c', type: 'bench', x: -0.85, z: -5.7, yaw: 0, paid: 120 },
  { id: 'shelf-d', type: 'gondola', x: 7.75, z: -3.6, yaw: -Math.PI / 2, paid: 150 },
  { id: 'shelf-e', type: 'gondola', x: 7.75, z: -2.05, yaw: -Math.PI / 2, paid: 150 },
];
export const START_VILLAS: VillaSpot[] = [{ id: 'villa-a', x: 0, z: -2.5, yaw: 0, paid: VILLA_BASE_COST }];

/**
 * Pre-build-mode saves referred to fixed spots by id. Kept so old saves load
 * into the same places.
 */
export const LEGACY_SHELVES: Record<string, Omit<ShelfSpot, 'id' | 'paid'>> = {
  'back-1': { type: 'gondola', x: -6.6, z: -5.75, yaw: 0 },
  'back-2': { type: 'gondola', x: -5.05, z: -5.75, yaw: 0 },
  'back-3': { type: 'gondola', x: 5.05, z: -5.75, yaw: 0 },
  'back-4': { type: 'gondola', x: 6.6, z: -5.75, yaw: 0 },
  'bench-1': { type: 'bench', x: -0.85, z: -5.7, yaw: 0 },
  'bench-2': { type: 'bench', x: 0.85, z: -5.7, yaw: 0 },
  'right-1': { type: 'gondola', x: 7.75, z: -3.6, yaw: -Math.PI / 2 },
  'right-2': { type: 'gondola', x: 7.75, z: -2.05, yaw: -Math.PI / 2 },
  'right-3': { type: 'gondola', x: 7.75, z: -0.5, yaw: -Math.PI / 2 },
  'right-4': { type: 'gondola', x: 7.75, z: 1.05, yaw: -Math.PI / 2 },
};
export const LEGACY_VILLAS: Record<string, { x: number; z: number }> = {
  'villa-1': { x: -3.6, z: -2.5 },
  'villa-2': { x: 0, z: -2.5 },
  'villa-3': { x: 3.6, z: -2.5 },
  'villa-4': { x: -3.6, z: 0.7 },
  'villa-5': { x: 0, z: 0.7 },
  'villa-6': { x: 3.6, z: 0.7 },
};
