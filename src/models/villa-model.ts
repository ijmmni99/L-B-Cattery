import * as THREE from 'three';
import { VILLA_SIZE } from '../config/villas';
import { cachedGeometry, cachedMaterial, cachedTexture, canvasTexture, makeCanvas, mesh, pastel, roundedBox } from '../core/cache';

const { w: W, d: D, platform: P } = VILLA_SIZE;
const HEADER_Y = 1.38;

function labelMaterial(text: string): THREE.MeshBasicMaterial {
  return cachedMaterial(`villa-label:${text}`, () => {
    const tex = cachedTexture(`villa-label-tex:${text}`, () => {
      const [c, g] = makeCanvas(512, 128);
      g.fillStyle = '#fffaf0';
      g.beginPath();
      g.roundRect(4, 4, 504, 120, 36);
      g.fill();
      g.fillStyle = '#3b3a4a';
      g.font = '900 64px "Nunito", ui-rounded, system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, 256, 68, 470);
      return canvasTexture(c);
    });
    return new THREE.MeshBasicMaterial({ map: tex });
  });
}

export interface VillaModel {
  /** Opaque static parts; merged by the manager. */
  frame: THREE.Group;
  /** Name plate; call `setLabel`. */
  plate: THREE.Mesh;
  setLabel(text: string): void;
  /** Invisible box covering the whole villa for the "choose a cat" ray. */
  proxy: THREE.Mesh;
}

/** A cat villa: wooden platform, three walls, a header beam with a name plate, bed and scratch post. */
export function buildVilla(tint: string): VillaModel {
  const frame = new THREE.Group();
  const trim = pastel(tint, 0.6);
  const wood = pastel('#d9a877', 0.7);
  const cream = pastel('#fff4e2', 0.8);

  const base = mesh(roundedBox(W, P, D, 0.04), wood);
  base.position.y = P / 2;
  const rug = mesh(cachedGeometry('villa-rug', () => new THREE.CylinderGeometry(0.62, 0.62, 0.012, 32)), pastel('#ffe1e6', 0.95), { cast: false });
  rug.position.set(0, P + 0.006, 0.1);
  frame.add(base, rug);

  const back = mesh(roundedBox(W - 0.1, HEADER_Y, 0.07, 0.03), cream);
  back.position.set(0, HEADER_Y / 2 + P, -D / 2 + 0.06);
  const wainscot = mesh(roundedBox(W - 0.1, 0.5, 0.09, 0.03), trim);
  wainscot.position.set(0, 0.25 + P, -D / 2 + 0.065);
  const windowRing = mesh(cachedGeometry('villa-window', () => new THREE.TorusGeometry(0.26, 0.04, 8, 28)), trim, { cast: false });
  windowRing.position.set(0, 1.0, -D / 2 + 0.105);
  const windowGlass = mesh(cachedGeometry('villa-window-fill', () => new THREE.CircleGeometry(0.26, 24)), pastel('#d8f0ff', 0.4), { cast: false });
  windowGlass.position.set(0, 1.0, -D / 2 + 0.098);
  frame.add(back, wainscot, windowRing, windowGlass);

  for (const side of [-1, 1]) {
    const wall = mesh(roundedBox(0.06, 0.62, D - 0.1, 0.025), trim);
    wall.position.set(side * (W / 2 - 0.05), 0.31 + P, 0);
    const post = mesh(roundedBox(0.1, HEADER_Y, 0.1, 0.03), trim);
    post.position.set(side * (W / 2 - 0.05), HEADER_Y / 2 + P, D / 2 - 0.08);
    frame.add(wall, post);
  }
  const header = mesh(roundedBox(W, 0.3, 0.12, 0.04), trim);
  header.position.set(0, HEADER_Y + P - 0.1, D / 2 - 0.08);
  frame.add(header);

  // Cat bed (back left) and scratching post (back right).
  const bed = mesh(cachedGeometry('villa-bed', () => new THREE.CylinderGeometry(0.27, 0.3, 0.1, 24)), pastel('#ffb3c7', 0.9));
  bed.position.set(-0.55, P + 0.05, -0.38);
  const bedDip = mesh(cachedGeometry('villa-bed-dip', () => new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20)), pastel('#fff0f4', 0.95), { cast: false });
  bedDip.position.set(-0.55, P + 0.1, -0.38);
  const postBase = mesh(roundedBox(0.3, 0.05, 0.3, 0.02), wood);
  postBase.position.set(0.6, P + 0.025, -0.42);
  const postPole = mesh(cachedGeometry('villa-pole', () => new THREE.CylinderGeometry(0.05, 0.05, 0.62, 12)), pastel('#e8c49a', 0.95));
  postPole.position.set(0.6, P + 0.34, -0.42);
  const postTop = mesh(roundedBox(0.26, 0.05, 0.26, 0.02), trim);
  postTop.position.set(0.6, P + 0.66, -0.42);
  frame.add(bed, bedDip, postBase, postPole, postTop);

  const plate = new THREE.Mesh(cachedGeometry('villa-plate', () => new THREE.PlaneGeometry(1.0, 0.25)), labelMaterial('Empty'));
  plate.position.set(0, HEADER_Y + P - 0.1, D / 2 - 0.015);
  plate.userData.dynamic = true;

  const proxy = new THREE.Mesh(
    cachedGeometry('villa-proxy', () => new THREE.BoxGeometry(W, HEADER_Y, D)),
    cachedMaterial('villa-proxy', () => new THREE.MeshBasicMaterial({ visible: false })),
  );
  proxy.position.set(0, HEADER_Y / 2 + P, 0);
  proxy.userData.dynamic = true;

  return {
    frame,
    plate,
    proxy,
    setLabel: (text) => {
      plate.material = labelMaterial(text);
    },
  };
}
