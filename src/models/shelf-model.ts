import * as THREE from 'three';
import { BACK_THICKNESS, BOARD_THICKNESS, PLINTH, SIDE_THICKNESS, type ShelfTypeDef } from '../config/shelves';
import { mesh, pastel, roundedBox } from '../core/cache';

export interface SlotFrame {
  tier: number;
  index: number;
  /** Slot centre on the board surface, in unit-local coordinates. */
  center: THREE.Vector3;
  /** Local front edge z (items start here and fill backward). */
  frontZ: number;
}

export interface ShelfGeometry {
  group: THREE.Group;
  slots: SlotFrame[];
  /** Outer footprint (width, depth) for collisions. */
  width: number;
  depth: number;
  height: number;
}

const COLORS = {
  side: '#8fd6c0',
  plinth: '#6fb9a2',
  board: '#fffaf1',
  back: '#ffe8cf',
  tag: '#ff8fab',
};

/** Builds the static frame of a shelf unit (origin: floor centre, front +Z). */
export function buildShelfGeometry(type: ShelfTypeDef): ShelfGeometry {
  const group = new THREE.Group();
  const width = type.slotsPerTier * type.slotW + SIDE_THICKNESS * 2;
  const depth = type.slotD + BACK_THICKNESS + 0.03;
  const backZ = -depth / 2 + BACK_THICKNESS / 2;
  const slotZ0 = -depth / 2 + BACK_THICKNESS; // back edge of the slot area
  const slotCenterZ = slotZ0 + type.slotD / 2;
  const frontZ = slotZ0 + type.slotD;

  const surfaces: number[] = [];
  let y = PLINTH + BOARD_THICKNESS;
  for (let t = 0; t < type.tiers; t++) {
    surfaces.push(y);
    y += type.clearHeight + BOARD_THICKNESS;
  }
  const height = y;

  const add = (w: number, h: number, d: number, r: number, color: string, x: number, yc: number, z: number, cast = true): void => {
    const m = mesh(roundedBox(w, h, d, r), pastel(color, 0.65), { cast });
    m.position.set(x, yc, z);
    group.add(m);
  };

  add(width, PLINTH, depth - 0.02, 0.025, COLORS.plinth, 0, PLINTH / 2, 0.0);
  add(width - SIDE_THICKNESS, height - PLINTH, BACK_THICKNESS, 0.012, COLORS.back, 0, PLINTH + (height - PLINTH) / 2, backZ);
  for (const s of [-1, 1]) {
    add(SIDE_THICKNESS, height, depth, 0.02, COLORS.side, s * (width / 2 - SIDE_THICKNESS / 2), height / 2, 0);
  }
  const innerW = width - SIDE_THICKNESS * 2;
  const boardDepth = depth - 0.01;
  surfaces.forEach((sy) => {
    add(innerW, BOARD_THICKNESS, boardDepth, 0.01, COLORS.board, 0, sy - BOARD_THICKNESS / 2, 0.0);
    // Tag strip along the front edge, below the board surface.
    add(innerW - 0.02, 0.045, 0.014, 0.006, COLORS.tag, 0, sy - BOARD_THICKNESS - 0.02, boardDepth / 2 + 0.005, false);
  });
  add(innerW, BOARD_THICKNESS, boardDepth, 0.01, COLORS.board, 0, height - BOARD_THICKNESS / 2, 0);
  // Little rounded crown so the top isn't a flat slab.
  add(width + 0.02, 0.04, depth + 0.02, 0.02, COLORS.side, 0, height + 0.02, 0);

  const slots: SlotFrame[] = [];
  surfaces.forEach((sy, tier) => {
    for (let i = 0; i < type.slotsPerTier; i++) {
      const x = (i - (type.slotsPerTier - 1) / 2) * type.slotW;
      slots.push({ tier, index: i, center: new THREE.Vector3(x, sy, slotCenterZ), frontZ });
    }
  });
  return { group, slots, width, depth, height: height + 0.04 };
}
