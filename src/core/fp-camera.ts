import * as THREE from 'three';

export const EYE_HEIGHT = 1.6;
const PITCH_LIMIT = THREE.MathUtils.degToRad(80);

/**
 * First-person view: yaw/pitch driven by look input, eye placed at the
 * player position with a gentle head bob while walking.
 * yaw = 0 looks toward -Z.
 */
export class FirstPersonCamera {
  yaw = 0;
  pitch = THREE.MathUtils.degToRad(-8);
  /** Radians per pixel of drag. */
  sensitivity = 0.0042;
  private bobPhase = 0;
  private bobAmount = 0;
  private readonly dir = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {
    camera.rotation.order = 'YXZ';
  }

  addLook(dxPixels: number, dyPixels: number, scale = 1): void {
    this.yaw -= dxPixels * this.sensitivity * scale;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dyPixels * this.sensitivity * scale, -PITCH_LIMIT, PITCH_LIMIT);
  }

  /** `speed` (m/s) drives head bob. */
  update(dt: number, position: THREE.Vector3, speed: number): void {
    const moving = Math.min(speed / 3, 1);
    this.bobAmount += (moving - this.bobAmount) * Math.min(dt * 8, 1);
    this.bobPhase += dt * (6 + speed * 1.8);
    const bob = Math.sin(this.bobPhase * 2) * 0.03 * this.bobAmount;
    this.camera.position.set(position.x, EYE_HEIGHT + bob, position.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bobPhase) * 0.004 * this.bobAmount);
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
