import './style.css';
import * as THREE from 'three';
import { GameRenderer } from './core/renderer';
import { GameLoop } from './core/loop';
import { FpsCounter } from './core/fps';
import { FirstPersonCamera } from './core/fp-camera';
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
import { createCrosshair } from './ui/crosshair';
import { setupLookInput } from './ui/look-input';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const ui = document.querySelector<HTMLDivElement>('#ui');
if (!canvas || !ui) throw new Error('Missing #scene or #ui root');

const quality = loadQuality();
const gfx = new GameRenderer(canvas, quality);
const store = buildStore(gfx.scene);
const colliders = buildStoreColliders();

// Camera joins the scene so carried objects parented to it render.
const view = new FirstPersonCamera(gfx.camera);
gfx.scene.add(gfx.camera);
const input = new Input();
const player = new Player(new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z), view);

const interactions = new InteractionSystem();
const ring = new TargetRing();
gfx.scene.add(ring.mesh);
const crate = createDemoCrate(gfx.scene, player, interactions, colliders, new THREE.Vector3(-1.2, 0, 2.2));

// Re-apply now that lights and meshes exist so shadow settings match the profile.
gfx.applyQuality(quality);

setupLookInput(canvas, view);
createJoystick(ui, input);
const crosshair = createCrosshair(ui);
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
  const target = interactions.update(view.eye, view.direction);
  const label = target?.label() ?? null;
  actionButton.setLabel(label);
  crosshair.setTarget(label);
  ring.update(dt, crate.placeSpot());
});

if (FpsCounter.enabled()) {
  // Test hook for automated checks (debug builds only).
  (window as Window & { __lb?: unknown }).__lb = { player, view, interactions };
  const fps = new FpsCounter(ui, () => gfx.drawCalls);
  loop.add((dt) => fps.update(dt));
}

loop.start();
setupPwa();
