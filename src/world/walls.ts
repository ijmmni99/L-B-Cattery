import * as THREE from 'three';
import { applyVerticalGradient, mesh, pastel, roundedBox, vertexTinted } from '../core/cache';
import { woodFloorTexture } from '../models/canvas-art';
import { DOOR, PALETTE, SHOP_WINDOW, STORE } from './layout';

const T = STORE.wallThickness;

type Axis = 'x' | 'z';

/**
 * Axis-aligned slab. `axis` is the direction the slab runs along; `fixed`
 * is its position on the other horizontal axis.
 */
function slab(
  axis: Axis,
  fixed: number,
  from: number,
  to: number,
  yMin: number,
  yMax: number,
  thickness: number,
  material: THREE.Material,
  gradient?: [string, string],
): THREE.Mesh {
  const len = to - from;
  const h = yMax - yMin;
  const w = axis === 'x' ? len : thickness;
  const d = axis === 'x' ? thickness : len;
  let geo: THREE.BufferGeometry = roundedBox(w, h, d, 0.05);
  if (gradient) geo = applyVerticalGradient(geo.clone(), gradient[0], gradient[1]);
  const m = mesh(geo, material);
  const mid = (from + to) / 2;
  if (axis === 'x') m.position.set(mid, yMin + h / 2, fixed);
  else m.position.set(fixed, yMin + h / 2, mid);
  return m;
}

/** Wall piece with mint wainscot, white rail and baseboard on its inner face. */
function finishedWall(
  group: THREE.Group,
  axis: Axis,
  fixed: number,
  inward: 1 | -1,
  from: number,
  to: number,
  yMin = 0,
  yMax: number = STORE.wallHeight,
): void {
  const wallMat = vertexTinted('wall');
  group.add(slab(axis, fixed, from, to, yMin, yMax, T, wallMat, ['#f6e6cf', PALETTE.creamTop]));
  if (yMin > 0.01) return; // header pieces above openings get no trim

  const face = fixed + inward * (T / 2);
  const wTop = Math.min(STORE.wainscotHeight, yMax);
  const wainscot = slab(axis, face + inward * 0.03, from, to, 0, wTop, 0.06, vertexTinted('wainscot'), [
    PALETTE.mintDark,
    PALETTE.mint,
  ]);
  group.add(wainscot);
  if (yMax >= STORE.wainscotHeight) {
    group.add(slab(axis, face + inward * 0.06, from, to, wTop - 0.03, wTop + 0.05, 0.08, pastel(PALETTE.trim, 0.5)));
  }
  group.add(slab(axis, face + inward * 0.07, from, to, 0, 0.16, 0.1, pastel(PALETTE.trim, 0.5)));
}

export function buildFloor(): THREE.Group {
  const g = new THREE.Group();
  const w = STORE.maxX - STORE.minX;
  const d = STORE.maxZ - STORE.minZ;
  const tex = woodFloorTexture().clone();
  tex.needsUpdate = true;
  tex.repeat.set(w / 4, d / 4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, color: '#ffffff' }),
  );
  floor.receiveShadow = true;
  g.add(floor);

  // Outdoor ground so the cut-away front never shows a void.
  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2),
    pastel('#cfe3d6', 1),
  );
  outside.position.y = -0.02;
  outside.receiveShadow = true;
  g.add(outside);
  return g;
}

export function buildWalls(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'walls';
  const { minX, maxX, minZ, maxZ, wallHeight } = STORE;

  // Back wall (runs along X), inner face toward +Z.
  finishedWall(g, 'x', minZ - T / 2, 1, minX - T, maxX + T);
  // Right wall (runs along Z), inner face toward -X.
  finishedWall(g, 'z', maxX + T / 2, -1, minZ, maxZ + T);

  // Left wall: solid / window / pillar / door / solid, inner face toward +X.
  const lx = minX - T / 2;
  finishedWall(g, 'z', lx, 1, minZ, SHOP_WINDOW.zMin);
  finishedWall(g, 'z', lx, 1, SHOP_WINDOW.zMin, SHOP_WINDOW.zMax, 0, SHOP_WINDOW.sill);
  finishedWall(g, 'z', lx, 1, SHOP_WINDOW.zMin, SHOP_WINDOW.zMax, SHOP_WINDOW.top, wallHeight);
  finishedWall(g, 'z', lx, 1, SHOP_WINDOW.zMax, DOOR.zMin);
  finishedWall(g, 'z', lx, 1, DOOR.zMin, DOOR.zMax, DOOR.height, wallHeight);
  finishedWall(g, 'z', lx, 1, DOOR.zMax, maxZ + T);

  // Wall-top caps for a clean "dollhouse" edge.
  const cap = pastel(PALETTE.trim, 0.5);
  g.add(slab('x', minZ - T / 2, minX - T - 0.04, maxX + T + 0.04, wallHeight, wallHeight + 0.08, T + 0.08, cap));
  g.add(slab('z', maxX + T / 2, minZ - T, maxZ + T + 0.04, wallHeight, wallHeight + 0.08, T + 0.08, cap));
  g.add(slab('z', lx, minZ - T, maxZ + T + 0.04, wallHeight, wallHeight + 0.08, T + 0.08, cap));

  // Low front rim (camera side).
  const rim = slab('x', maxZ + T / 2, minX - T, maxX + T, 0, STORE.frontRimHeight, T, vertexTinted('wainscot'), [
    PALETTE.mintDark,
    PALETTE.mint,
  ]);
  g.add(rim);
  g.add(slab('x', maxZ + T / 2, minX - T - 0.04, maxX + T + 0.04, STORE.frontRimHeight, STORE.frontRimHeight + 0.07, T + 0.08, cap));
  return g;
}
