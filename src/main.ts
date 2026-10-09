import './style.css';
import * as THREE from 'three';
import { GameRenderer } from './core/renderer';
import { GameLoop } from './core/loop';
import { FpsCounter } from './core/fps';
import { CameraRig } from './core/camera-rig';
import { Input } from './core/input';
import { loadQuality, saveQuality } from './core/quality';
import { setupPwa } from './core/pwa';
import { buildStore } from './world/store';
import { buildStoreColliders } from './world/store-colliders';
import { PLAYER_START } from './world/layout';
import { Player } from './game/player';
import { InteractionSystem } from './game/interactions';
import { TargetRing } from './game/target-ring';
import { createDemoCrate } from './game/demo-crate';
import { createQualityPicker } from './ui/quality-picker';
import { createJoystick } from './ui/joystick';
import { createActionButton } from './ui/action-button';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const ui = document.querySelector<HTMLDivElement>('#ui');
if (!canvas || !ui) throw new Error('Missing #scene or #ui root');

const quality = loadQuality();
const gfx = new GameRenderer(canvas, quality);
const store = buildStore(gfx.scene);
const colliders = buildStoreColliders();

const input = new Input();
const player = new Player(new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z));
gfx.scene.add(player.object);

const interactions = new InteractionSystem();
const ring = new TargetRing();
gfx.scene.add(ring.mesh);
createDemoCrate(gfx.scene, player, interactions, colliders, new THREE.Vector3(-2, 0, 0.5));

// Re-apply now that lights and meshes exist so shadow settings match the profile.
gfx.applyQuality(quality);

const rig = new CameraRig(gfx.camera, canvas);
rig.setAspect(gfx.camera.aspect);
gfx.onResize((w, h) => rig.setAspect(w / h));
rig.target.copy(player.position);
rig.snap();

createJoystick(ui, input);
const actionButton = createActionButton(ui, input);
input.onAction(() => interactions.trigger());
createQualityPicker(ui, quality, (level) => {
  saveQuality(level);
  gfx.applyQuality(level);
});

const loop = new GameLoop(() => gfx.render());
loop.add(store.update);
loop.add((dt) => {
  input.update();
  player.update(dt, input, colliders);
  const target = interactions.update(player.position, player.facing);
  actionButton.setLabel(target?.label() ?? null);
  ring.update(dt, target?.position ?? null, target && target.radius < 1 ? 0.45 : 0.35);
  rig.target.copy(player.position);
  rig.update(dt);
});

if (FpsCounter.enabled()) {
  // Test hook for automated checks (debug builds only).
  (window as Window & { __lb?: unknown }).__lb = { player, interactions };
  const fps = new FpsCounter(ui, () => gfx.drawCalls);
  loop.add((dt) => fps.update(dt));
}

loop.start();
setupPwa();
