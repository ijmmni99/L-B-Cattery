import './style.css';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GameRenderer } from './core/renderer';
import { GameLoop } from './core/loop';
import { FpsCounter } from './core/fps';
import { loadQuality, saveQuality } from './core/quality';
import { setupPwa } from './core/pwa';
import { createQualityPicker } from './ui/quality-picker';

// M0 smoke test: a rotating rounded cube proves renderer, loop, resize,
// quality settings and PWA all work on a phone. Replaced by the store in M1.

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const ui = document.querySelector<HTMLDivElement>('#ui');
if (!canvas || !ui) throw new Error('Missing #scene or #ui root');

const quality = loadQuality();
const gfx = new GameRenderer(canvas, quality);
const { scene, camera } = gfx;

scene.background = new THREE.Color('#fff7ec');
camera.position.set(0, 2.2, 5);
camera.lookAt(0, 0.6, 0);

scene.add(new THREE.HemisphereLight('#fffaf0', '#cfe9df', 1.6));
const sun = new THREE.DirectionalLight('#ffffff', 1.8);
sun.position.set(3, 6, 4);
sun.shadow.camera.left = -4;
sun.shadow.camera.right = 4;
sun.shadow.camera.top = 4;
sun.shadow.camera.bottom = -4;
sun.shadow.bias = -0.0005;
sun.shadow.radius = 4;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(4, 48),
  new THREE.MeshStandardMaterial({ color: '#e8c9a0', roughness: 0.9 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const cube = new THREE.Mesh(
  new RoundedBoxGeometry(1.4, 1.4, 1.4, 6, 0.28),
  new THREE.MeshStandardMaterial({ color: '#7fcfb8', roughness: 0.45 }),
);
cube.position.y = 1.2;
cube.castShadow = true;
scene.add(cube);

// Re-apply now that the light exists so its shadow settings match the profile.
gfx.applyQuality(quality);

const title = document.createElement('div');
title.className = 'm0-title';
title.textContent = 'L&B Cattery · M0';
ui.appendChild(title);

createQualityPicker(ui, quality, (level) => {
  saveQuality(level);
  gfx.applyQuality(level);
});

const loop = new GameLoop(() => gfx.render());
loop.add((dt, t) => {
  cube.rotation.y += dt * 0.8;
  cube.rotation.x = Math.sin(t * 0.7) * 0.35;
  cube.position.y = 1.2 + Math.sin(t * 1.6) * 0.12;
});

if (FpsCounter.enabled()) {
  const fps = new FpsCounter(ui, () => gfx.drawCalls);
  loop.add((dt) => fps.update(dt));
}

loop.start();
setupPwa();
