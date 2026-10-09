import * as THREE from 'three';
import { cachedGeometry, cachedMaterial, mesh, pastel, roundedBox } from '../core/cache';
import { blobShadow } from '../models/blob-shadow';
import { catPosterTexture, logoTexture } from '../models/canvas-art';
import { PALETTE, PLANT_SPOTS, STORE } from './layout';

const BACK_FACE = STORE.minZ;
const RIGHT_FACE = STORE.maxX;

function logoSign(): THREE.Group {
  const g = new THREE.Group();
  const board = mesh(roundedBox(5.6, 1.35, 0.14, 0.12, 4), pastel(PALETTE.mintDark, 0.45));
  g.add(board);
  const inset = mesh(roundedBox(5.35, 1.12, 0.06, 0.1, 4), pastel('#8fd6c0', 0.5));
  inset.position.z = 0.07;
  g.add(inset);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(5.1, 1.275),
    new THREE.MeshStandardMaterial({
      map: logoTexture(),
      transparent: true,
      emissive: '#ffffff',
      emissiveMap: logoTexture(),
      emissiveIntensity: 0.55,
      roughness: 0.6,
    }),
  );
  face.position.z = 0.11;
  g.add(face);
  g.position.set(0, 2.42, BACK_FACE + 0.1);
  return g;
}

function sconceMaterial(): THREE.MeshStandardMaterial {
  return cachedMaterial('sconce-glow', () =>
    new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd99a', emissiveIntensity: 2.2 }),
  );
}

/** Warm wall lamp; `facing` rotates it to point away from its wall. */
function sconce(x: number, z: number, facing: number): THREE.Group {
  const g = new THREE.Group();
  const plate = mesh(roundedBox(0.22, 0.32, 0.05, 0.025), pastel('#f1d27a', 0.35, 0.5), { cast: false });
  g.add(plate);
  const arm = mesh(cachedGeometry('sconce-arm', () => new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8).rotateX(Math.PI / 2)), pastel('#f1d27a', 0.35, 0.5), { cast: false });
  arm.position.set(0, 0, 0.1);
  g.add(arm);
  const bulb = new THREE.Mesh(cachedGeometry('sconce-bulb', () => new THREE.SphereGeometry(0.13, 16, 12)), sconceMaterial());
  bulb.position.set(0, 0.04, 0.22);
  g.add(bulb);
  g.position.set(x, 2.35, z);
  g.rotation.y = facing;
  return g;
}

function poster(variant: number): THREE.Group {
  const g = new THREE.Group();
  const frame = mesh(roundedBox(0.86, 1.06, 0.06, 0.04), pastel('#ffffff', 0.5), { cast: false });
  g.add(frame);
  const art = new THREE.Mesh(
    cachedGeometry('poster-plane', () => new THREE.PlaneGeometry(0.72, 0.9)),
    new THREE.MeshStandardMaterial({ map: catPosterTexture(variant), roughness: 0.8 }),
  );
  art.position.z = 0.035;
  g.add(art);
  return g;
}

function wallClock(): THREE.Group {
  const g = new THREE.Group();
  const rim = mesh(cachedGeometry('clock-rim', () => new THREE.CylinderGeometry(0.34, 0.34, 0.07, 32).rotateX(Math.PI / 2)), pastel(PALETTE.pink, 0.5), { cast: false });
  g.add(rim);
  const face = mesh(cachedGeometry('clock-face', () => new THREE.CylinderGeometry(0.28, 0.28, 0.02, 32).rotateX(Math.PI / 2)), pastel('#ffffff', 0.6), { cast: false });
  face.position.z = 0.04;
  g.add(face);
  const handMat = pastel(PALETTE.ink, 0.6);
  const hour = mesh(roundedBox(0.035, 0.16, 0.015, 0.007), handMat, { cast: false });
  hour.position.set(0.04, 0.05, 0.055);
  hour.rotation.z = -0.9;
  const minute = mesh(roundedBox(0.025, 0.22, 0.015, 0.007), handMat, { cast: false });
  minute.position.set(0, 0.1, 0.06);
  g.add(hour, minute);
  return g;
}

/** Lathe pot + clustered foliage spheres. */
function plant(scale = 1, leafColor = '#7fcf9c'): THREE.Group {
  const g = new THREE.Group();
  const pot = mesh(
    cachedGeometry('pot', () => {
      const pts = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.2, 0),
        new THREE.Vector2(0.26, 0.38),
        new THREE.Vector2(0.3, 0.42),
        new THREE.Vector2(0.28, 0.46),
        new THREE.Vector2(0, 0.46),
      ];
      return new THREE.LatheGeometry(pts, 24);
    }),
    pastel('#f7c59f', 0.7),
  );
  g.add(pot);
  const leafGeo = cachedGeometry('leaf-ball', () => new THREE.IcosahedronGeometry(0.3, 2));
  const leaf = pastel(leafColor, 0.85);
  const blobs: Array<[number, number, number, number]> = [
    [0, 0.78, 0, 1.15],
    [0.17, 0.66, 0.08, 0.85],
    [-0.16, 0.68, -0.06, 0.9],
    [0.02, 1.02, -0.04, 0.8],
    [-0.06, 0.62, 0.17, 0.7],
  ];
  for (const [x, y, z, s] of blobs) {
    const b = mesh(leafGeo, leaf);
    b.position.set(x, y, z);
    b.scale.setScalar(s);
    g.add(b);
  }
  g.add(blobShadow(0.9));
  g.scale.setScalar(scale);
  return g;
}

export function buildDecor(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'decor';
  g.add(logoSign());

  for (const x of [-5.2, 5.2]) g.add(sconce(x, BACK_FACE + 0.05, 0));
  for (const z of [-2.6, 2.6]) g.add(sconce(RIGHT_FACE - 0.05, z, -Math.PI / 2));

  [0, 1, 2].forEach((i) => {
    const p = poster(i);
    p.position.set(RIGHT_FACE - 0.04, 1.95, (i - 1) * 1.15);
    p.rotation.y = -Math.PI / 2;
    g.add(p);
  });

  const clock = wallClock();
  clock.position.set(3.9, 2.5, BACK_FACE + 0.05);
  g.add(clock);

  for (const [x, z, s, c] of PLANT_SPOTS) {
    const p = plant(s, c);
    p.position.set(x, 0, z);
    p.rotation.y = x * 1.3 + z;
    g.add(p);
  }
  return g;
}
