import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { QUALITY_PROFILES, type QualityLevel, type QualityProfile } from './quality';

/** First-person FOV, applied to the screen's shorter axis. */
export const WORLD_FOV = 72;
/** Viewmodel (hands / held items) uses a calmer FOV so they don't distort. */
export const VIEWMODEL_FOV = 58;
const MAX_FOV = 100;

/**
 * Landscape: `fov` is vertical. Portrait: `fov` becomes the horizontal angle
 * (converted to vertical for three.js) so the view doesn't collapse.
 */
export function fovForAspect(fov: number, aspect: number): number {
  if (aspect >= 1) return fov;
  const half = THREE.MathUtils.degToRad(fov / 2);
  const v = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) / aspect));
  return Math.min(v, MAX_FOV);
}

export interface RenderLayer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

/**
 * Owns the WebGL renderer, the main scene/camera and optional bloom.
 * Antialias can only be chosen at context creation, so changing quality
 * re-applies everything else live and keeps the initial antialias choice.
 */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  profile: QualityProfile;

  /** Drawn after the world with depth cleared, so it never clips into walls. */
  private overlay: RenderLayer | null = null;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private readonly resizeListeners: Array<(w: number, h: number) => void> = [];

  constructor(canvas: HTMLCanvasElement, level: QualityLevel) {
    this.profile = QUALITY_PROFILES[level];
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.profile.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    // PCF is filtered/soft by default in current three.js.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Reset stats manually so the debug counter covers every pass in a frame.
    this.renderer.info.autoReset = false;

    // Near plane 0.05 so walls right in front of the eye don't get cut open.
    this.camera = new THREE.PerspectiveCamera(WORLD_FOV, 1, 0.05, 120);

    this.applyQuality(level);
    window.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('resize', this.resize);
    this.resize();
  }

  applyQuality(level: QualityLevel): void {
    this.profile = QUALITY_PROFILES[level];
    const p = this.profile;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatioCap));
    this.renderer.shadowMap.enabled = p.shadows;
    this.renderer.shadowMap.needsUpdate = true;

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.DirectionalLight) {
        obj.castShadow = p.shadows;
        if (obj.shadow.mapSize.x !== p.shadowMapSize) {
          obj.shadow.mapSize.set(p.shadowMapSize, p.shadowMapSize);
          obj.shadow.map?.dispose();
          obj.shadow.map = null;
        }
      }
      // Materials must recompile when shadow state flips.
      if (obj instanceof THREE.Mesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.needsUpdate = true;
      }
    });

    if (p.bloom) this.ensureComposer();
    else this.disposeComposer();
    this.resize();
  }

  setOverlay(layer: RenderLayer): void {
    this.overlay = layer;
    // Rebuild the bloom chain so it includes the overlay pass.
    if (this.composer) {
      this.disposeComposer();
      this.ensureComposer();
    }
    this.resize();
  }

  onResize(fn: (w: number, h: number) => void): void {
    this.resizeListeners.push(fn);
  }

  render(): void {
    this.renderer.info.reset();
    if (this.composer) {
      this.composer.render();
      return;
    }
    this.renderer.render(this.scene, this.camera);
    if (this.overlay) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.overlay.scene, this.overlay.camera);
      this.renderer.autoClear = true;
    }
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  private ensureComposer(): void {
    if (this.composer) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.overlay) {
      const pass = new RenderPass(this.overlay.scene, this.overlay.camera);
      pass.clear = false;
      pass.clearDepth = true;
      this.composer.addPass(pass);
    }
    // Threshold 1.0: only HDR-bright emissives (signs, lamps) glow, not walls.
    this.bloomPass = new UnrealBloomPass(size, 0.3, 0.4, 1.0);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  private disposeComposer(): void {
    if (!this.composer) return;
    this.bloomPass?.dispose();
    this.composer.dispose();
    this.composer = null;
    this.bloomPass = null;
  }

  private readonly resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = fovForAspect(WORLD_FOV, this.camera.aspect);
    this.camera.updateProjectionMatrix();
    if (this.overlay) {
      const c = this.overlay.camera;
      c.aspect = w / h;
      c.fov = fovForAspect(VIEWMODEL_FOV, c.aspect);
      c.updateProjectionMatrix();
    }
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    for (const fn of this.resizeListeners) fn(w, h);
  };
}
