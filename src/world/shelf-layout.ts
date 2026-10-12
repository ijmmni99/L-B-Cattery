import { BACK_THICKNESS } from '../config/shelves';
import { STORE } from './layout';

export interface ShelfSpot {
  id: string;
  type: 'gondola' | 'bench';
  x: number;
  z: number;
  /** Rotation about Y; the unit's front faces local +Z. */
  yaw: number;
}

/** Outer depth of a unit (slot depth + back panel + trim). */
const DEPTH = { gondola: 0.46, bench: 0.56 } as const;

const wall = 0.02;
const backZ = (type: ShelfSpot['type']): number => STORE.minZ + DEPTH[type] / 2 + wall + BACK_THICKNESS * 0;
const rightX = (type: ShelfSpot['type']): number => STORE.maxX - DEPTH[type] / 2 - wall;

/**
 * Initial shelf placement (all unlocked in M4; buying more comes in M7).
 * Back wall: two gondolas in each corner and two low benches in the middle.
 * Right wall: four gondolas.
 */
export const SHELF_SPOTS: ShelfSpot[] = [
  { id: 'back-1', type: 'gondola', x: -6.6, z: backZ('gondola'), yaw: 0 },
  { id: 'back-2', type: 'gondola', x: -5.05, z: backZ('gondola'), yaw: 0 },
  { id: 'back-3', type: 'gondola', x: 5.05, z: backZ('gondola'), yaw: 0 },
  { id: 'back-4', type: 'gondola', x: 6.6, z: backZ('gondola'), yaw: 0 },
  { id: 'bench-1', type: 'bench', x: -0.85, z: backZ('bench'), yaw: 0 },
  { id: 'bench-2', type: 'bench', x: 0.85, z: backZ('bench'), yaw: 0 },
  { id: 'right-1', type: 'gondola', x: rightX('gondola'), z: -3.6, yaw: -Math.PI / 2 },
  { id: 'right-2', type: 'gondola', x: rightX('gondola'), z: -2.05, yaw: -Math.PI / 2 },
  { id: 'right-3', type: 'gondola', x: rightX('gondola'), z: -0.5, yaw: -Math.PI / 2 },
  { id: 'right-4', type: 'gondola', x: rightX('gondola'), z: 1.05, yaw: -Math.PI / 2 },
];

/** Floor area where deliveries arrive (front-left corner, away from the door). */
export const DELIVERY_PAD = { x: -5.6, z: 4.7, w: 2.6, d: 1.7 } as const;
