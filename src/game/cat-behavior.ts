import * as THREE from 'three';
import { PERSONALITY_ACTIVITY, type CatActivityId, type Personality } from '../config/cats';

/** Area a cat may roam in (circle on the floor). */
export interface RoamArea {
  center: THREE.Vector3;
  radius: number;
}

const DURATION: Record<CatActivityId, [number, number]> = {
  idle: [3, 6],
  sit: [5, 9],
  sleep: [9, 16],
  stretch: [2.6, 2.6],
  walk: [0, 0], // until the target is reached
  play: [4, 7],
  eat: [4, 6],
  groom: [4, 7],
};

/**
 * Picks what a cat does next from its personality, and handles walking to
 * a random spot inside its roam area. Sleep is always followed by a stretch.
 */
export class CatBehavior {
  activity: CatActivityId = 'idle';
  /** When set, the cat holds this activity (showcase "force" buttons). */
  forced: CatActivityId | null = null;
  readonly target = new THREE.Vector3();
  private timeLeft = 1 + Math.random() * 2;
  /** Player-triggered activity that overrides everything until it runs out. */
  private interruptLeft = 0;
  private nextMeow = 6 + Math.random() * 10;

  constructor(
    private readonly personality: Personality,
    private readonly area: RoamArea,
  ) {}

  /** Returns true when a meow should happen this frame. */
  update(dt: number, position: THREE.Vector3): { changed: boolean; meow: boolean } {
    let changed = false;
    if (this.interruptLeft > 0) {
      this.interruptLeft -= dt;
    } else if (this.forced && this.activity !== this.forced) {
      this.start(this.forced, position);
      changed = true;
    } else if (!this.forced) {
      this.timeLeft -= dt;
      const arrived = this.activity === 'walk' && position.distanceTo(this.target) < 0.08;
      if ((this.activity !== 'walk' && this.timeLeft <= 0) || arrived || (this.activity === 'walk' && this.timeLeft < -12)) {
        this.start(this.pickNext(), position);
        changed = true;
      }
    }
    let meow = false;
    if (this.activity !== 'sleep') {
      this.nextMeow -= dt * (this.personality === 'Shy' ? 0.5 : 1);
      if (this.nextMeow <= 0) {
        meow = true;
        this.nextMeow = 8 + Math.random() * 14;
      }
    }
    return { changed, meow };
  }

  /** Player-triggered activity: overrides forced/automatic choices for `seconds`. */
  interrupt(activity: CatActivityId, position: THREE.Vector3, seconds: number): void {
    this.start(activity, position);
    this.interruptLeft = seconds;
  }

  /** Start an activity right away. */
  start(activity: CatActivityId, position: THREE.Vector3): void {
    this.activity = activity;
    const [lo, hi] = DURATION[activity];
    this.timeLeft = lo + Math.random() * (hi - lo);
    if (activity === 'walk') this.pickTarget(position);
  }

  private pickNext(): CatActivityId {
    if (this.activity === 'sleep') return 'stretch';
    const weights = PERSONALITY_ACTIVITY[this.personality];
    const entries = (Object.entries(weights) as Array<[CatActivityId, number]>).filter(([a]) => a !== this.activity);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [a, w] of entries) {
      r -= w;
      if (r <= 0) return a;
    }
    return 'idle';
  }

  private pickTarget(position: THREE.Vector3): void {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.area.radius;
      this.target.set(this.area.center.x + Math.cos(a) * r, this.area.center.y, this.area.center.z + Math.sin(a) * r);
      if (this.target.distanceTo(position) > 0.6) return;
    }
  }
}
