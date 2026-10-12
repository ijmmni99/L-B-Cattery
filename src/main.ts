import './style.css';
import * as THREE from 'three';
import { GameRenderer } from './core/renderer';
import { GameLoop } from './core/loop';
import { FpsCounter } from './core/fps';
import { FirstPersonCamera } from './core/fp-camera';
import { Input } from './core/input';
import { getSettings, onSettingsChange } from './core/settings';
import { setupPwa } from './core/pwa';
import { buildStore } from './world/store';
import { buildStoreColliders } from './world/store-colliders';
import { DOOR_INSIDE, PLAYER_START } from './world/layout';
import { ViewModel } from './models/viewmodel';
import { Player } from './game/player';
import { InteractionSystem } from './game/interactions';
import { Highlighter } from './game/highlight';
import { TargetRing } from './game/target-ring';
import { BoxManager } from './game/boxes';
import { ShelfManager } from './game/shelves';
import { OrderSystem } from './game/orders';
import { CustomerSystem } from './game/customers';
import { ShopDoor } from './world/door';
import { buildCounter } from './world/counter';
import { gameStore } from './game/state';
import { PRODUCT_BY_ID } from './config/products';
import { buildDeliveryPad } from './world/delivery-pad';
import { CatShowcase } from './game/cat-showcase';
import { VillaManager, type Villa } from './game/villas';
import { createCatShop } from './ui/cat-shop';
import { createJoystick } from './ui/joystick';
import { createActionButton } from './ui/action-button';
import { createCrosshair } from './ui/crosshair';
import { setupLookInput } from './ui/look-input';
import { createSettingsPanel } from './ui/settings-panel';
import { createShowcasePanel } from './ui/cat-showcase-ui';
import { createInfoCard } from './ui/info-card';
import { createHud } from './ui/hud';
import { createTablet } from './ui/tablet';
import { createCheckoutPanel } from './ui/checkout';
import { initToasts } from './ui/toast';

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
gfx.scene.add(buildDeliveryPad());
const boxes = new BoxManager(gfx.scene, player, interactions, colliders);
const shelves = new ShelfManager(gfx.scene, colliders, interactions, boxes, () => hands.kick());
const orders = new OrderSystem(boxes);
const counter = buildCounter(colliders);
gfx.scene.add(counter.group);
const door = new ShopDoor();
gfx.scene.add(door.group);
const customers = new CustomerSystem(gfx.scene, shelves, interactions, counter, colliders, player.position);
const catTestMode = new URLSearchParams(location.search).get('cats') === '1';
// Debug cat stage (?cats=1) and the real villas share the middle of the shop, so only one is built.
const showcase = new CatShowcase(gfx.scene, interactions, colliders, catTestMode);
let openCatShop: (villa: Villa) => void = () => undefined;
const villas = catTestMode ? null : new VillaManager(gfx.scene, colliders, interactions, (v) => openCatShop(v));

// Re-apply now that lights and meshes exist so shadow settings match the profile.
gfx.applyQuality(getSettings().quality);
onSettingsChange((s) => {
  if (s.quality !== gfx.profile.level) gfx.applyQuality(s.quality);
});

setupLookInput(canvas, view, () => interactions.press(), () => interactions.release());
createJoystick(ui, input);
const crosshair = createCrosshair(ui);
const actionButton = createActionButton(ui, input);
input.onActionDown(() => interactions.press());
input.onActionUp(() => interactions.release());
createSettingsPanel(ui);
initToasts(ui);
const hud = createHud(ui);
createTablet(ui, orders);
createCheckoutPanel(ui, customers);
if (catTestMode) createShowcasePanel(ui, showcase);
if (villas) openCatShop = createCatShop(ui, villas);
const infoCard = createInfoCard(ui);

const loop = new GameLoop(() => gfx.render());
loop.add(store.update);
loop.add((dt) => {
  showcase.update(dt);
  villas?.update(dt);
});
loop.add((dt) => {
  orders.update(dt);
  boxes.update(dt);
  shelves.update(dt);
  customers.update(dt);
  const dx = DOOR_INSIDE.x - 0.4;
  door.update(dt, customers.anyNear(dx, DOOR_INSIDE.z, 2.3) || Math.hypot(player.position.x - dx, player.position.z - DOOR_INSIDE.z) < 1.8);
  hud.setDeliveryEta(orders.nextEta);
});
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
  infoCard.show(target?.info?.() ?? null);
  highlighter.update(dt);
  ring.update(dt, boxes.placeSpot());
});

if (FpsCounter.enabled()) {
  // Test hook for automated checks (debug builds only).
  (window as Window & { __lb?: unknown }).__lb = { player, view, interactions, scene: gfx.scene, showcase, boxes, shelves, orders, customers, colliders, door, villas, gameStore, products: PRODUCT_BY_ID };
  const fps = new FpsCounter(ui, () => gfx.drawCalls);
  loop.add((dt) => fps.update(dt));
}

loop.start();
setupPwa();
