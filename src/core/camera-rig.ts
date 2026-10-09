import * as THREE from 'three';

export interface CameraRigOptions {
  /** Camera offset direction from target (normalised internally). */
  direction?: THREE.Vector3;
  distance?: number;
  minZoom?: number;
  maxZoom?: number;
  /** Higher = snappier follow. */
  damping?: number;
  /** Look slightly above the target's feet. */
  lookHeight?: number;
}

/**
 * Third-person follow camera, slightly top-down. Smoothly tracks a target
 * point; pinch (touch) and mouse wheel zoom between limits.
 */
export class CameraRig {
  readonly target = new THREE.Vector3();
  private readonly dir: THREE.Vector3;
  private readonly landscapeDir: THREE.Vector3;
  private readonly portraitDir: THREE.Vector3;
  private readonly baseDistance: number;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private readonly damping: number;
  private readonly lookHeight: number;
  private zoom = 1;
  private aspectDistance = 1;
  private zoomGoal = 1;
  private readonly focus = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchStart = 0;
  private zoomAtPinchStart = 1;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    element: HTMLElement,
    opts: CameraRigOptions = {},
  ) {
    this.landscapeDir = (opts.direction ?? new THREE.Vector3(0, 0.82, 1)).clone().normalize();
    // Portrait screens are tall: look down more so the floor fills them, not the sky.
    this.portraitDir = new THREE.Vector3(0, 1.6, 1).normalize();
    this.dir = this.landscapeDir.clone();
    this.baseDistance = opts.distance ?? 11;
    this.minZoom = opts.minZoom ?? 0.6;
    this.maxZoom = opts.maxZoom ?? 1.35;
    this.damping = opts.damping ?? 6;
    this.lookHeight = opts.lookHeight ?? 1.1;

    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
  }

  /** Call on resize; picks the pitch that suits the screen shape. */
  setAspect(aspect: number): void {
    this.dir.copy(aspect < 1 ? this.portraitDir : this.landscapeDir);
    // Narrow screens see less sideways; back off so the room still fits.
    this.aspectDistance = aspect < 1 ? THREE.MathUtils.clamp(1 / aspect, 1, 1.4) : 1;
  }

  /** Jump straight to the target (no easing), e.g. on load. */
  snap(): void {
    this.zoom = this.zoomGoal;
    this.focus.copy(this.target);
    this.computeDesired();
    this.camera.position.copy(this.desired);
    this.lookAtFocus();
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-this.damping * dt);
    this.zoom += (this.zoomGoal - this.zoom) * k;
    this.focus.lerp(this.target, k);
    this.computeDesired();
    this.camera.position.lerp(this.desired, k);
    this.lookAtFocus();
  }

  private computeDesired(): void {
    this.desired.copy(this.dir).multiplyScalar(this.baseDistance * this.zoom * this.aspectDistance).add(this.focus);
  }

  private lookAtFocus(): void {
    this.camera.lookAt(this.focus.x, this.focus.y + this.lookHeight, this.focus.z);
  }

  private setZoomGoal(z: number): void {
    this.zoomGoal = THREE.MathUtils.clamp(z, this.minZoom, this.maxZoom);
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.setZoomGoal(this.zoomGoal * (1 + Math.sign(e.deltaY) * 0.1));
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      this.pinchStart = this.pinchDistance();
      this.zoomAtPinchStart = this.zoomGoal;
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 2 && this.pinchStart > 0) {
      // Fingers apart -> zoom in (smaller distance factor).
      this.setZoomGoal(this.zoomAtPinchStart * (this.pinchStart / Math.max(this.pinchDistance(), 1)));
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchStart = 0;
  };

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
