import * as THREE from 'three';
import { cachedGeometry, cachedMaterial, mesh, pastel, roundedBox } from '../core/cache';
import { cityBackdropTexture, openSignTexture } from '../models/canvas-art';
import { DOOR, PALETTE, SHOP_WINDOW, STORE } from './layout';

const T = STORE.wallThickness;
const WALL_X = STORE.minX - T / 2;

function glassMaterial(): THREE.MeshStandardMaterial {
  return cachedMaterial('glass', () =>
    new THREE.MeshStandardMaterial({
      color: '#cdeef5',
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
}

/** Frame bar running along Z (horizontal) or Y (vertical) at the wall plane. */
function frameBar(z0: number, z1: number, y0: number, y1: number, depth = T + 0.08, size = 0.1): THREE.Mesh {
  const vertical = Math.abs(y1 - y0) > Math.abs(z1 - z0);
  const len = vertical ? y1 - y0 : z1 - z0;
  const geo = vertical ? roundedBox(depth, len, size, 0.04) : roundedBox(depth, size, len, 0.04);
  const m = mesh(geo, pastel(PALETTE.trim, 0.4));
  m.position.set(WALL_X, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
}

function buildWindow(g: THREE.Group): void {
  const { zMin, zMax, sill, top } = SHOP_WINDOW;
  const glass = new THREE.Mesh(
    cachedGeometry('window-glass', () => new THREE.PlaneGeometry(zMax - zMin, top - sill)),
    glassMaterial(),
  );
  glass.rotation.y = Math.PI / 2;
  glass.position.set(WALL_X, (sill + top) / 2, (zMin + zMax) / 2);
  glass.renderOrder = 2;
  g.add(glass);

  g.add(frameBar(zMin, zMax, sill, sill));
  g.add(frameBar(zMin, zMax, top, top));
  g.add(frameBar(zMin, zMin, sill, top));
  g.add(frameBar(zMax, zMax, sill, top));
  const panes = 3;
  for (let i = 1; i < panes; i++) {
    const z = zMin + ((zMax - zMin) * i) / panes;
    g.add(frameBar(z, z, sill, top, T * 0.6, 0.07));
  }
  // Deep interior sill shelf (future display spot).
  const ledge = mesh(roundedBox(0.42, 0.07, zMax - zMin + 0.2, 0.03), pastel(PALETTE.trim, 0.5));
  ledge.position.set(STORE.minX + 0.12, sill + 0.03, (zMin + zMax) / 2);
  g.add(ledge);
}

function buildDoor(g: THREE.Group): void {
  const { zMin, zMax, height } = DOOR;
  g.add(frameBar(zMin, zMin, 0, height));
  g.add(frameBar(zMax, zMax, 0, height));
  g.add(frameBar(zMin, zMax, height, height));

  const w = zMax - zMin - 0.14;
  const panel = new THREE.Group();
  const frameMat = pastel(PALETTE.mintDark, 0.5);
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
  handle.position.set(0.1, 1.15, w / 2 - 0.25);
  panel.add(handle);
  panel.position.set(WALL_X, 0, (zMin + zMax) / 2);
  g.add(panel);

  // Welcome mat just inside the door.
  const mat = mesh(roundedBox(1.1, 0.03, 1.7, 0.015), pastel('#f4a6a0', 0.95), { cast: false });
  mat.position.set(STORE.minX + 0.75, 0.015, (zMin + zMax) / 2);
  g.add(mat);
}

/** Hanging neon sign; returns an updater for its gentle pulse. */
function buildOpenSign(g: THREE.Group): (t: number) => void {
  const mat = new THREE.MeshBasicMaterial({ map: openSignTexture(), transparent: true });
  const base = new THREE.Color(1.6, 1.6, 1.6); // >1 so High-quality bloom picks it up
  mat.color.copy(base);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.48), mat);
  sign.rotation.y = Math.PI / 2;
  sign.position.set(STORE.minX + 0.1, 2.05, SHOP_WINDOW.zMax - 0.85);
  g.add(sign);
  const cordMat = pastel('#8a8494', 0.6);
  for (const dz of [-0.4, 0.4]) {
    const cord = new THREE.Mesh(cachedGeometry('cord', () => new THREE.CylinderGeometry(0.008, 0.008, 0.38, 4)), cordMat);
    cord.position.set(STORE.minX + 0.1, 2.48, sign.position.z + dz);
    g.add(cord);
  }
  return (t) => {
    const k = 0.92 + Math.sin(t * 2.2) * 0.05 + (Math.sin(t * 17) > 0.97 ? -0.15 : 0);
    mat.color.copy(base).multiplyScalar(k);
  };
}

function buildOutside(g: THREE.Group): void {
  const sidewalk = mesh(roundedBox(3, 0.06, 30, 0.02), pastel('#e8dccb', 0.95), { cast: false });
  sidewalk.position.set(STORE.minX - T - 1.5, 0.0, 0);
  g.add(sidewalk);
  // Tiny curb + hedge row so the street side reads as a tidy plaza.
  const curb = mesh(roundedBox(0.25, 0.14, 30, 0.05), pastel('#ffffff', 0.8), { cast: false });
  curb.position.set(STORE.minX - T - 3.1, 0.07, 0);
  g.add(curb);
  const hedgeGeo = cachedGeometry('hedge', () => new THREE.IcosahedronGeometry(0.5, 2));
  for (let z = -13; z <= 13; z += 1.3) {
    const h = mesh(hedgeGeo, pastel(z % 2.6 === 0 ? '#86d3a0' : '#7cc996', 0.9), { cast: false });
    h.position.set(STORE.minX - T - 0.75, 0.5, z);
    h.scale.set(1.2, 1.3, 1.3);
    g.add(h);
  }

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 20),
    new THREE.MeshBasicMaterial({ map: cityBackdropTexture(), fog: false }),
  );
  backdrop.rotation.y = Math.PI / 2;
  backdrop.position.set(STORE.minX - 8, 6, 0);
  g.add(backdrop);
}

export interface Storefront {
  group: THREE.Group;
  update: (t: number) => void;
}

export function buildStorefront(): Storefront {
  const group = new THREE.Group();
  group.name = 'storefront';
  buildWindow(group);
  buildDoor(group);
  buildOutside(group);
  const pulse = buildOpenSign(group);
  return { group, update: pulse };
}
