import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { QUALITY_PROFILES, type QualityLevel, type QualityProfile } from './quality';

const BASE_FOV = 50;
const MAX_FOV = 62;

/** In portrait, keep the landscape horizontal view by widening vertical FOV. */
function fovForAspect(aspect: number): number {
  if (aspect >= 1) return BASE_FOV;
  const half = THREE.MathUtils.degToRad(BASE_FOV / 2);
  const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) / aspect));
  return Math.min(fov, MAX_FOV);
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

    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 200);

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

  onResize(fn: (w: number, h: number) => void): void {
    this.resizeListeners.push(fn);
  }

  render(): void {
    this.renderer.info.reset();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  private ensureComposer(): void {
    if (this.composer) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
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
    this.camera.fov = fovForAspect(this.camera.aspect);
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    for (const fn of this.resizeListeners) fn(w, h);
  };
}
