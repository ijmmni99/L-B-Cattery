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
import { gameStore, onLevelUp, onPriceChange, setProductPrice } from './game/state';
import { clearSave, loadSave, resolveLayout, writeSave, type SaveData } from './core/save';
import { levelForXp } from './config/progression';
import { DEFAULT_PRICE, PRODUCTS } from './config/products';
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
import { MESS } from './config/care';
import { MessSystem } from './game/mess';
import { StaffSystem } from './game/staff';
import { formatClock } from './config/day';
import { DayCycle } from './game/day';
import { createDayReport } from './ui/day-report';
import { BuildMode } from './game/build-mode';
import { createGoals } from './ui/goals';
import { sfx } from './core/sfx';
import { createBuildBar } from './ui/build-bar';
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
const catTestMode = new URLSearchParams(location.search).get('cats') === '1';
// Debug cat stage (?cats=1) and the real villas share the middle of the shop, so only one is built.
const showcase = new CatShowcase(gfx.scene, interactions, colliders, catTestMode);
let openCatShop: (villa: Villa) => void = () => undefined;
const villas = catTestMode ? null : new VillaManager(gfx.scene, colliders, interactions, (v) => openCatShop(v));
const mess = new MessSystem(gfx.scene, interactions);
const cleanliness = (): number => {
  const cats = villas?.villas.filter((v) => v.cat) ?? [];
  const dirt = cats.length ? cats.reduce((n, v) => n + v.dirt, 0) / cats.length : 0;
  return Math.max(0, Math.min(1, 1 - mess.count * MESS.perMess - dirt * MESS.perVillaDirt));
};
const customers = new CustomerSystem(gfx.scene, shelves, interactions, counter, colliders, player.position, villas, mess, cleanliness);
const day = new DayCycle();
customers.schedule = { isOpen: () => day.isOpen, rush: () => day.rush };
const staff = new StaffSystem(gfx.scene, customers.nav, customers, mess, villas);

// ---- Save / load (localStorage). Restored before the first frame.
const snapshot = (): SaveData => {
  const st = gameStore.getState();
  return {
    v: 1,
    money: st.money,
    xp: st.xp,
    prices: Object.fromEntries(PRODUCTS.filter((p) => p.price !== DEFAULT_PRICE[p.id]).map((p) => [p.id, p.price])),
    layout: { shelves: shelves.layout(), villas: villas?.villas.map((v) => ({ ...v.spot })) ?? [] },
    shelves: shelves.serialize(),
    villas: villas?.serialize() ?? [],
    boxes: boxes.serialize(),
    orders: orders.serialize(),
    staff: staff.roles(),
    day: day.serialize(),
  };
};
const saved = loadSave();
const layout = resolveLayout(saved);
for (const spot of layout.shelves) shelves.addUnit(spot);
const savedVillas = new Map((saved?.villas ?? []).map((v) => [v.id, v]));
if (villas) {
  villas.takeFood = () => shelves.takeFood();
  villas.hasFood = () => shelves.hasFood();
}
for (const spot of layout.villas) villas?.addVilla(spot, savedVillas.get(spot.id)?.cat ?? null, savedVillas.get(spot.id));
if (saved) {
  const xp = Math.max(0, saved.xp ?? 0);
  gameStore.setState({ money: saved.money, xp, level: levelForXp(xp) });
  for (const [id, price] of Object.entries(saved.prices ?? {})) setProductPrice(id, price);
  shelves.restore(saved.shelves ?? []);
  boxes.spawnBoxes(saved.boxes ?? []);
  orders.restore(saved.orders ?? []);
  if (saved.day) day.restore(saved.day);
  for (const r of saved.staff ?? []) if (r === 'cashier' || r === 'cleaner' || r === 'caretaker') staff.hire(r, true);
}
onPriceChange(() => shelves.markDirty());
let resetting = false;
const save = (): void => {
  if (!resetting) writeSave(snapshot());
};
setInterval(save, 8000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});
window.addEventListener('pagehide', save);
const resetGame = (): void => {
  resetting = true;
  clearSave();
  location.reload();
};

// Re-apply now that lights and meshes exist so shadow settings match the profile.
gfx.applyQuality(getSettings().quality);
onSettingsChange((s) => {
  if (s.quality !== gfx.profile.level) gfx.applyQuality(s.quality);
});

const build = new BuildMode(gfx.scene, gfx.camera, shelves, villas, colliders, customers.nav, boxes);
const press = (): void => {
  if (build.active) build.confirm();
  else interactions.press();
};
setupLookInput(canvas, view, press, () => !build.active && interactions.release());
createJoystick(ui, input);
const crosshair = createCrosshair(ui);
const actionButton = createActionButton(ui, input);
input.onActionDown(press);
input.onActionUp(() => !build.active && interactions.release());
createSettingsPanel(ui, undefined, resetGame);
initToasts(ui);
const hud = createHud(ui);
createTablet(ui, orders, staff);
const checkoutPanel = createCheckoutPanel(ui, customers);
createBuildBar(ui, build, villas !== null, () => undefined);
createDayReport(ui, day);
day.onReport(() => {
  checkoutPanel.dismiss();
  customers.clearAll();
});
if (catTestMode) createShowcasePanel(ui, showcase);
if (villas) openCatShop = createCatShop(ui, villas);
const infoCard = createInfoCard(ui);
const goals = createGoals(ui, { shelves, boxes, orders, customers, villas });
onLevelUp(() => sfx.levelUp());

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
  // The shop is paused while building and while the end-of-day report is up.
  if (!build.active && day.phase !== 'report') {
    customers.update(dt);
    staff.update(dt);
    day.update(dt, customers.inStore, cleanliness());
  }
  hud.setClean(cleanliness());
  hud.setClock(day.day, formatClock(day.hour), day.isOpen);
  goals.update(dt);
  goals.setVisible(!build.active);
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
  if (build.active) {
    build.update();
    const label = build.label();
    actionButton.setLabel(label);
    crosshair.setOnTarget(label !== null);
    highlighter.setTarget(null);
    infoCard.show(null);
  } else {
    const label = target?.label() ?? null;
    actionButton.setLabel(label);
    crosshair.setOnTarget(label !== null);
    highlighter.setTarget(interactions.highlightTarget);
    infoCard.show(target?.info?.() ?? null);
  }
  highlighter.update(dt);
  ring.update(dt, boxes.placeSpot());
});

if (FpsCounter.enabled()) {
  // Test hook for automated checks (debug builds only).
  (window as Window & { __lb?: unknown }).__lb = { player, view, interactions, scene: gfx.scene, showcase, boxes, shelves, orders, customers, colliders, door, villas, build, staff, mess, day, snapshot, gameStore, products: PRODUCT_BY_ID };
  const fps = new FpsCounter(ui, () => gfx.drawCalls);
  loop.add((dt) => fps.update(dt));
}

loop.start();
setupPwa(save, ui);
document.getElementById('splash')?.classList.add('out');
setTimeout(() => document.getElementById('splash')?.remove(), 600);
// Stop mobile browsers from showing menus / zoom on long-press and double-tap.
document.addEventListener('contextmenu', (e) => e.preventDefault());
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault());
// Keep the screen awake while playing.
let wake: WakeLockSentinel | null = null;
const holdScreen = async (): Promise<void> => {
  try {
    if (!document.hidden) wake = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    wake = null;
  }
};
void holdScreen();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void holdScreen();
});
void wake;
