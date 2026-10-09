import * as THREE from 'three';
import { getSettings } from './settings';

export const EYE_HEIGHT = 1.6;
const PITCH_LIMIT = THREE.MathUtils.degToRad(80);
/** Base radians per pixel of drag, scaled by the Settings sensitivity. */
const BASE_SENSITIVITY = 0.0042;

/**
 * First-person view: yaw/pitch driven by look input, eye placed at the
 * player position with an optional head bob. yaw = 0 looks toward -Z.
 */
export class FirstPersonCamera {
  yaw = 0;
  pitch = THREE.MathUtils.degToRad(-8);
  /** Look change applied this frame (for viewmodel sway). */
  readonly lookDelta = new THREE.Vector2();
  private pendingYaw = 0;
  private pendingPitch = 0;
  private bobPhase = 0;
  private bobAmount = 0;
  private readonly dir = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {
    camera.rotation.order = 'YXZ';
  }

  addLook(dxPixels: number, dyPixels: number, scale = 1): void {
    const s = BASE_SENSITIVITY * getSettings().lookSensitivity * scale;
    this.pendingYaw -= dxPixels * s;
    this.pendingPitch -= dyPixels * s;
  }

  /** `speed` (m/s) drives the optional head bob. */
  update(dt: number, position: THREE.Vector3, speed: number): void {
    const before = this.pitch;
    this.yaw += this.pendingYaw;
    this.pitch = THREE.MathUtils.clamp(this.pitch + this.pendingPitch, -PITCH_LIMIT, PITCH_LIMIT);
    this.lookDelta.set(this.pendingYaw, this.pitch - before);
    this.pendingYaw = 0;
    this.pendingPitch = 0;

    const bobOn = getSettings().headBob;
    const moving = bobOn ? Math.min(speed / 3, 1) : 0;
    this.bobAmount += (moving - this.bobAmount) * Math.min(dt * 8, 1);
    this.bobPhase += dt * (6 + speed * 1.8);
    const bob = Math.sin(this.bobPhase * 2) * 0.03 * this.bobAmount;
    this.camera.position.set(position.x, EYE_HEIGHT + bob, position.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bobPhase) * 0.004 * this.bobAmount);
    this.camera.updateMatrixWorld();
  }

  get eye(): THREE.Vector3 {
    return this.camera.position;
  }

  /** Unit view direction. */
  get direction(): THREE.Vector3 {
    return this.camera.getWorldDirection(this.dir);
  }

  /**
   * Where the view ray meets the floor, limited to `reach` metres
   * horizontally. Falls back to a point straight ahead when looking up.
   */
  floorPoint(reach: number, fallback = 1.2): THREE.Vector3 {
    const d = this.direction;
    const eye = this.eye;
    if (d.y < -0.05) {
      const t = -eye.y / d.y;
      const hx = d.x * t;
      const hz = d.z * t;
      const h = Math.hypot(hx, hz);
      if (h <= reach) return new THREE.Vector3(eye.x + hx, 0, eye.z + hz);
    }
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    return new THREE.Vector3(eye.x + fx * fallback, 0, eye.z + fz * fallback);
  }
}
