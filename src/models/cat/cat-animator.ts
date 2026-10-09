import * as THREE from 'three';
import type { CatModel } from './cat-builder';
import { POSE_KEYS, POSES, zeroPose, type CatAnim, type CatPose } from './cat-poses';

const BLEND_TIME = 0.45;

/**
 * Drives a cat's skeleton: cross-fades between state poses and layers
 * blink, breathing, tail sway and meow head-lifts on top.
 */
export class CatAnimator {
  anim: CatAnim = 'idle';
  private time = 0;
  private stateTime = 0;
  private blend = 1;
  private readonly from = zeroPose();
  private readonly target = zeroPose();
  private readonly current = zeroPose();
  private readonly rest = new Map<THREE.Bone, { pos: THREE.Vector3; rot: THREE.Euler }>();
  private readonly seed = Math.random() * 10;
  private nextBlink = 1 + Math.random() * 3;
  private blinkT = -1;
  private meowT = -1;

  constructor(private readonly model: CatModel) {
    model.bones.root.traverse((o) => {
      if (o instanceof THREE.Bone) this.rest.set(o, { pos: o.position.clone(), rot: o.rotation.clone() });
    });
  }

  play(anim: CatAnim): void {
    if (anim === this.anim) return;
    Object.assign(this.from, this.current);
    this.anim = anim;
    this.stateTime = 0;
    this.blend = 0;
  }

  /** Short head lift for a meow (bubble/sound handled by the caller). */
  meow(): void {
    this.meowT = 0;
  }

  /** Seconds spent in the current animation. */
  get elapsed(): number {
    return this.stateTime;
  }

  update(dt: number): void {
    this.time += dt;
    this.stateTime += dt;
    this.blend = Math.min(1, this.blend + dt / BLEND_TIME);

    const t = this.target;
    Object.assign(t, zeroPose());
    POSES[this.anim](t, this.stateTime, this.seed);

    const k = this.blend * this.blend * (3 - 2 * this.blend);
    const c = this.current;
    for (const key of POSE_KEYS) c[key] = this.from[key] + (t[key] - this.from[key]) * k;

    this.apply(c, dt);
  }

  private apply(p: CatPose, dt: number): void {
    const b = this.model.bones;
    const r = (bone: THREE.Bone) => this.rest.get(bone) as { pos: THREE.Vector3; rot: THREE.Euler };

    // Meow: quick head lift.
    let meowLift = 0;
    if (this.meowT >= 0) {
      this.meowT += dt;
      meowLift = Math.sin(Math.min(this.meowT / 0.7, 1) * Math.PI) * 0.4;
      if (this.meowT > 0.7) this.meowT = -1;
    }

    const hr = r(b.hips);
    b.hips.position.set(hr.pos.x, hr.pos.y + p.hipsY, hr.pos.z + p.hipsZ);
    b.hips.rotation.set(p.hipsPitch, 0, p.hipsRoll);
    b.chest.rotation.set(p.chestPitch, p.chestYaw, 0);
    b.head.rotation.set(p.headPitch - meowLift, p.headYaw, p.headRoll);

    // Breathing: gentle chest swell; head counter-scaled so it doesn't pulse.
    const breath = 1 + Math.sin(this.time * (p.breath > 1.2 ? 1.6 : 2.4)) * 0.022 * p.breath;
    b.chest.scale.set(breath, breath, 1);
    b.head.scale.set(1 / breath, 1 / breath, 1);

    b.legFL.rotation.set(p.fl, 0, p.flRoll);
    b.legFR.rotation.set(p.fr, 0, p.frRoll);
    b.legBL.rotation.set(p.bl, 0, 0);
    b.legBR.rotation.set(p.br, 0, 0);

    const tail0 = r(b.tail[0]);
    for (let i = 0; i < b.tail.length; i++) {
      const sway = Math.sin(this.time * Math.PI * 2 * p.tailSpeed * 0.5 - i * 0.7) * p.tailWag;
      const bone = b.tail[i];
      const baseX = i === 0 ? tail0.rot.x - p.tailLift : 0;
      bone.rotation.set(baseX - p.tailCurl, 0, p.tailSide + sway);
    }

    // Blink (also respects closed-eye states).
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blinkT < 0) {
      this.blinkT = 0;
      this.nextBlink = 2 + Math.random() * 4;
    }
    let blink = 1;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      blink = Math.abs(1 - this.blinkT / 0.08);
      if (this.blinkT > 0.16) this.blinkT = -1;
    }
    const open = Math.max(0.08, Math.min(p.eyes, blink));
    b.eyes.scale.set(1, open, 1);
  }
}
