import './style.css';
import * as THREE from 'three';
import { GameRenderer } from './core/renderer';
import { GameLoop } from './core/loop';
import { FpsCounter } from './core/fps';
import { FirstPersonCamera } from './core/fp-camera';
import { Input } from './core/input';
import { haptic } from './core/haptics';
import { getSettings, onSettingsChange } from './core/settings';
import { setupPwa } from './core/pwa';
import { buildStore } from './world/store';
import { buildStoreColliders } from './world/store-colliders';
import { PLAYER_START } from './world/layout';
import { ViewModel } from './models/viewmodel';
import { Player } from './game/player';
import { InteractionSystem } from './game/interactions';
import { Highlighter } from './game/highlight';
import { TargetRing } from './game/target-ring';
import { createDemoCrate } from './game/demo-crate';
import { CatShowcase } from './game/cat-showcase';
import { createJoystick } from './ui/joystick';
import { createActionButton } from './ui/action-button';
import { createCrosshair } from './ui/crosshair';
import { setupLookInput } from './ui/look-input';
import { createSettingsPanel } from './ui/settings-panel';
import { createCatInfoCard, createShowcasePanel } from './ui/cat-showcase-ui';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const ui = document.querySelector<HTMLDivElement>('#ui');
if (!canvas || !ui) throw new Error('Missing #scene or #ui root');

const gfx = new GameRenderer(canvas, getSettings().quality);
const store = buildStore(gfx.scene);
const colliders = buildStoreColliders();

// First-person camera + hands overlay (drawn on top, never clips walls).
const view = new FirstPersonCamera(gfx.camera);
const hands = new ViewModel();
gfx.setOverlay({ scene: hands.scene, camera: hands.camera });
gfx.onResize(() => hands.layout());
hands.layout();

const input = new Input();
const player = new Player(new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z), view, hands.carryAnchor);

const interactions = new InteractionSystem();
const highlighter = new Highlighter();
const ring = new TargetRing();
gfx.scene.add(ring.mesh);
const crate = createDemoCrate(gfx.scene, player, interactions, colliders, new THREE.Vector3(-3.6, 0, 2.6));
const showcase = new CatShowcase(gfx.scene, interactions, colliders);

// Re-apply now that lights and meshes exist so shadow settings match the profile.
gfx.applyQuality(getSettings().quality);
onSettingsChange((s) => {
  if (s.quality !== gfx.profile.level) gfx.applyQuality(s.quality);
});

const interact = (): void => {
  if (interactions.trigger()) haptic(18);
};
setupLookInput(canvas, view, interact);
createJoystick(ui, input);
const crosshair = createCrosshair(ui);
const actionButton = createActionButton(ui, input);
input.onAction(() => interactions.trigger());
createSettingsPanel(ui);
createShowcasePanel(ui, showcase);
const catCard = createCatInfoCard(ui);

const loop = new GameLoop(() => gfx.render());
loop.add(store.update);
loop.add((dt) => showcase.update(dt));
loop.add((dt) => {
  input.update();
  player.update(dt, input, colliders);
  hands.carrying = player.carried !== null;
  hands.update(dt, player.speed, view.lookDelta.x, view.lookDelta.y);

  const target = interactions.update(gfx.camera);
  const label = target?.label() ?? null;
  actionButton.setLabel(label);
  crosshair.setOnTarget(label !== null);
  highlighter.setTarget(interactions.highlightTarget);
  catCard.show(showcase.catFor(target)?.data ?? null);
  highlighter.update(dt);
  ring.update(dt, crate.placeSpot());
});

if (FpsCounter.enabled()) {
  // Test hook for automated checks (debug builds only).
  (window as Window & { __lb?: unknown }).__lb = { player, view, interactions, scene: gfx.scene, showcase };
  const fps = new FpsCounter(ui, () => gfx.drawCalls);
  loop.add((dt) => fps.update(dt));
}

loop.start();
setupPwa();
