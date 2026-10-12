import * as THREE from 'three';
import { mesh, pastel, roundedBox } from '../core/cache';
import { DOOR, PALETTE } from './layout';
import { glassMaterial, WALL_X } from './storefront';

const OPEN_ANGLE = 1.75;

/** The glass entrance door: swings outward when someone walks up to it. */
export class ShopDoor {
  readonly group = new THREE.Group();
  private open = 0;

  constructor() {
    const { zMin, zMax, height } = DOOR;
    const w = zMax - zMin - 0.14;
    const frameMat = pastel(PALETTE.mintDark, 0.5);
    const panel = new THREE.Group();
    const bars: Array<[number, number, number, number]> = [
      [w, 0.12, 0, height - 0.12],
      [w, 0.32, 0, 0.16],
      [0.1, height - 0.1, -w / 2 + 0.05, (height - 0.1) / 2],
      [0.1, height - 0.1, w / 2 - 0.05, (height - 0.1) / 2],
    ];
    for (const [bw, bh, bz, by] of bars) {
      const bar = mesh(roundedBox(0.08, bh, bw, 0.03), frameMat);
      bar.position.set(0, by, bz);
      panel.add(bar);
    }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, height - 0.5), glassMaterial());
    glass.rotation.y = Math.PI / 2;
    glass.position.y = height / 2 - 0.02;
    panel.add(glass);
    const handle = mesh(roundedBox(0.06, 0.6, 0.06, 0.03), pastel('#f1d27a', 0.3, 0.6));
    handle.position.set(0.1, 1.15, -w / 2 + 0.25);
    panel.add(handle);
    // Hinge on the +Z jamb; the panel extends toward -Z.
    panel.position.z = -w / 2;
    this.group.add(panel);
    this.group.position.set(WALL_X, 0, zMax - 0.07);
  }

  /** `near` = someone is at the door. */
  update(dt: number, near: boolean): void {
    const target = near ? 1 : 0;
    this.open += Math.sign(target - this.open) * Math.min(Math.abs(target - this.open), dt * 2.2);
    const e = this.open * this.open * (3 - 2 * this.open);
    this.group.rotation.y = e * OPEN_ANGLE;
  }
}
