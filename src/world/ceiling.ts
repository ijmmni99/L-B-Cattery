import * as THREE from 'three';
import { cachedMaterial, mesh, pastel, roundedBox } from '../core/cache';
import { STORE } from './layout';

function panelMaterial(): THREE.MeshStandardMaterial {
  return cachedMaterial('ceiling-panel', () =>
    new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff4dc', emissiveIntensity: 1.6 }),
  );
}

/** Cream ceiling with a grid of soft glowing light panels. */
export function buildCeiling(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'ceiling';
  const w = STORE.maxX - STORE.minX + 0.6;
  const d = STORE.maxZ - STORE.minZ + 0.6;
  const y = STORE.wallHeight;

  // Faces down, so it only gets dim ground bounce; a soft self-glow keeps it bright.
  const ceilingMat = cachedMaterial('ceiling', () =>
    new THREE.MeshStandardMaterial({ color: '#fbf4e8', roughness: 0.9, emissive: '#fff6ea', emissiveIntensity: 0.55 }),
  );
  const slab = mesh(roundedBox(w, 0.12, d, 0.04), ceilingMat, { cast: false, receive: false });
  slab.position.set((STORE.minX + STORE.maxX) / 2, y + 0.06, (STORE.minZ + STORE.maxZ) / 2);
  g.add(slab);

  // Crown moulding where ceiling meets the walls.
  const trim = pastel('#ffffff', 0.5);
  const cw = STORE.maxX - STORE.minX;
  const cd = STORE.maxZ - STORE.minZ;
  const strips: Array<[number, number, number, number]> = [
    [0, STORE.minZ + 0.05, cw, 0.1],
    [0, STORE.maxZ - 0.05, cw, 0.1],
    [STORE.minX + 0.05, 0, 0.1, cd],
    [STORE.maxX - 0.05, 0, 0.1, cd],
  ];
  for (const [x, z, sw, sd] of strips) {
    const s = mesh(roundedBox(sw, 0.12, sd, 0.04), trim, { cast: false, receive: false });
    s.position.set(x, y - 0.06, z);
    g.add(s);
  }

  // 3 x 2 light panels with a pale frame each.
  const frame = pastel('#efe6d6', 0.6);
  for (const x of [-5, 0, 5]) {
    for (const z of [-2.8, 2.4]) {
      const f = mesh(roundedBox(1.7, 0.05, 1.0, 0.04), frame, { cast: false, receive: false });
      f.position.set(x, y - 0.025, z);
      const p = mesh(roundedBox(1.5, 0.04, 0.8, 0.03), panelMaterial(), { cast: false, receive: false });
      p.position.set(x, y - 0.05, z);
      g.add(f, p);
    }
  }
  return g;
}
