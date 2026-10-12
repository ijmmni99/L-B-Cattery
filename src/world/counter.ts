import * as THREE from 'three';
import { mesh, pastel, roundedBox } from '../core/cache';
import { COUNTER, PALETTE } from './layout';
import type { CollisionWorld } from './colliders';

export interface CheckoutCounter {
  group: THREE.Group;
  /** Raycast target for the "Checkout" action. */
  register: THREE.Object3D;
}

/** The shop counter with a cash register; also registers its collider. */
export function buildCounter(colliders: CollisionWorld): CheckoutCounter {
  const { x, z, w, d, height } = COUNTER;
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const body = mesh(roundedBox(w, height - 0.06, d, 0.05), pastel(PALETTE.mint, 0.7));
  body.position.y = (height - 0.06) / 2;
  const top = mesh(roundedBox(w + 0.1, 0.06, d + 0.1, 0.03), pastel(PALETTE.wood, 0.6));
  top.position.y = height - 0.03;
  const trim = mesh(roundedBox(w - 0.2, 0.08, 0.02, 0.01), pastel(PALETTE.pink, 0.6), { cast: false });
  trim.position.set(0, 0.55, -d / 2 - 0.005);
  g.add(body, top, trim);

  const register = new THREE.Group();
  const base = mesh(roundedBox(0.4, 0.14, 0.32, 0.03), pastel('#f3f0ea', 0.5));
  base.position.y = 0.07;
  const screen = mesh(roundedBox(0.34, 0.2, 0.04, 0.02), pastel(PALETTE.ink, 0.4));
  screen.position.set(0, 0.22, 0.1);
  screen.rotation.x = -0.35;
  const glow = mesh(roundedBox(0.28, 0.13, 0.01, 0.01), pastel('#9fe8c9', 0.3), { cast: false });
  glow.position.set(0, 0, 0.026);
  screen.add(glow);
  register.add(base, screen);
  register.position.set(-0.55, height, 0);
  g.add(register);

  // Little bell and bowl of candy so the counter feels lived-in.
  const bell = mesh(new THREE.SphereGeometry(0.06, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), pastel('#f1d27a', 0.3, 0.6));
  bell.position.set(0.6, height, 0.05);
  g.add(bell);

  colliders.addCentered(x, z, w + 0.1, d + 0.1);
  return { group: g, register: g };
}
