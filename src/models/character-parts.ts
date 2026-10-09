import * as THREE from 'three';
import { cachedGeometry } from '../core/cache';
import { PartBuilder } from './part-builder';

/** Shared primitive shapes used to assemble humans. */
export const shapes = {
  sphere: () => cachedGeometry('h-sphere', () => new THREE.SphereGeometry(1, 20, 14)),
  capsule: (r: number, len: number) =>
    cachedGeometry(`h-capsule:${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14)),
  /** Upper part of a sphere (hair caps). `theta` = how far down it reaches. */
  cap: (theta: number) =>
    cachedGeometry(`h-cap:${theta}`, () => new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, theta)),
  cylinder: (rt: number, rb: number, h: number) =>
    cachedGeometry(`h-cyl:${rt}:${rb}:${h}`, () => new THREE.CylinderGeometry(rt, rb, h, 16)),
};

export const HAIR_STYLES = ['short', 'ponytail', 'bun', 'bob', 'curly', 'long', 'beanie'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const HEAD_RADIUS = 0.3;

/** Adds hair (relative to head centre) for the given style. */
export function addHair(b: PartBuilder, style: HairStyle, color: THREE.ColorRepresentation, accent: THREE.ColorRepresentation): void {
  const r = HEAD_RADIUS;
  // Offsets below were authored for a 0.25 head; scale them to the real size.
  const k = r / 0.25;
  const at = (x: number, y: number, z: number): [number, number, number] => [x * k, y * k, z * k];
  const capR = r * 1.07;
  switch (style) {
    case 'short':
      b.add(shapes.cap(1.25), color, at(0, 0.02, -0.01), [-0.25, 0, 0], capR);
      break;
    case 'ponytail':
      b.add(shapes.cap(1.3), color, at(0, 0.02, -0.01), [-0.3, 0, 0], capR);
      b.add(shapes.sphere(), accent, at(0, 0.08, -0.25), [0, 0, 0], 0.045 * k);
      b.add(shapes.capsule(0.07, 0.16), color, at(0, -0.04, -0.31), [0.35, 0, 0], k);
      break;
    case 'bun':
      b.add(shapes.cap(1.3), color, at(0, 0.02, -0.01), [-0.25, 0, 0], capR);
      b.add(shapes.sphere(), color, at(0, 0.27, -0.05), [0, 0, 0], 0.11 * k);
      break;
    case 'bob':
      b.add(shapes.cap(1.95), color, at(0, 0.0, -0.02), [-0.45, 0, 0], [capR * 1.04, capR, capR * 1.04]);
      break;
    case 'curly':
      b.add(shapes.cap(1.3), color, at(0, 0.02, -0.01), [-0.25, 0, 0], capR);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        b.add(shapes.sphere(), color, at(Math.cos(a) * 0.2, 0.15 + Math.sin(i * 1.7) * 0.03, Math.sin(a) * 0.2 - 0.03), [0, 0, 0], 0.09 * k);
      }
      b.add(shapes.sphere(), color, at(0, 0.25, -0.02), [0, 0, 0], 0.12 * k);
      break;
    case 'long':
      b.add(shapes.cap(1.4), color, at(0, 0.02, -0.01), [-0.3, 0, 0], capR);
      b.add(shapes.capsule(0.2, 0.22), color, at(0, -0.12, -0.12), [0.15, 0, 0], [1.05 * k, k, 0.55 * k]);
      break;
    case 'beanie':
      b.add(shapes.cap(1.1), accent, at(0, 0.05, 0), [-0.15, 0, 0], capR * 1.04);
      b.add(shapes.cylinder(0.27, 0.27, 0.07), accent, at(0, 0.05, 0.01), [-0.15, 0, 0], k);
      b.add(shapes.sphere(), '#ffffff', at(0, 0.31, -0.04), [0, 0, 0], 0.06 * k);
      break;
  }
}

/** Simple cute face on the +Z side of the head. */
export function addFace(b: PartBuilder, skin: THREE.Color): void {
  const r = HEAD_RADIUS;
  const eye = '#2f2b3d';
  for (const s of [-1, 1]) {
    b.add(shapes.sphere(), eye, [s * 0.1, 0.0, r * 0.93], [0, 0, 0], [0.042, 0.055, 0.024]);
    b.add(shapes.sphere(), '#ffffff', [s * 0.1 + 0.013, 0.02, r * 0.975], [0, 0, 0], 0.014);
    b.add(shapes.sphere(), '#ff9fa8', [s * 0.17, -0.07, r * 0.83], [0, 0, 0], [0.048, 0.026, 0.02]);
    // ears
    b.add(shapes.sphere(), skin, [s * r * 0.98, -0.02, 0], [0, 0, 0], [0.04, 0.06, 0.045]);
  }
  b.add(shapes.sphere(), skin.clone().multiplyScalar(0.92), [0, -0.035, r * 0.98], [0, 0, 0], 0.022);
  b.add(shapes.capsule(0.009, 0.045), '#b85c6a', [0, -0.11, r * 0.93], [0, 0, Math.PI / 2]);
}
