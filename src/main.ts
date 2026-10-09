import './style.css';
import { GameRenderer } from './core/renderer';
import { GameLoop } from './core/loop';
import { FpsCounter } from './core/fps';
import { CameraRig } from './core/camera-rig';
import { loadQuality, saveQuality } from './core/quality';
import { setupPwa } from './core/pwa';
import { buildStore } from './world/store';
import { createQualityPicker } from './ui/quality-picker';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const ui = document.querySelector<HTMLDivElement>('#ui');
if (!canvas || !ui) throw new Error('Missing #scene or #ui root');

const quality = loadQuality();
const gfx = new GameRenderer(canvas, quality);
const store = buildStore(gfx.scene);
// Re-apply now that lights exist so shadow settings match the profile.
gfx.applyQuality(quality);

const rig = new CameraRig(gfx.camera, canvas);
rig.setAspect(gfx.camera.aspect);
gfx.onResize((w, h) => rig.setAspect(w / h));
rig.snap();

createQualityPicker(ui, quality, (level) => {
  saveQuality(level);
  gfx.applyQuality(level);
});

const loop = new GameLoop(() => gfx.render());
loop.add(store.update);

// M1 demo: the camera target tours the store until the player exists (M2).
loop.add((_dt, t) => {
  const a = t * 0.12;
  rig.target.set(Math.sin(a) * 4.5, 0, Math.cos(a * 1.3) * 2.5);
});
loop.add((dt) => rig.update(dt));

if (FpsCounter.enabled()) {
  const fps = new FpsCounter(ui, () => gfx.drawCalls);
  loop.add((dt) => fps.update(dt));
}

loop.start();
setupPwa();
