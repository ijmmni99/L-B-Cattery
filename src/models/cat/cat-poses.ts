/**
 * Pose = offsets from the rest skeleton. Each animation state is a function
 * of time producing a pose; the animator cross-fades between them.
 */
export interface CatPose {
  hipsY: number;
  hipsZ: number;
  hipsPitch: number;
  hipsRoll: number;
  chestPitch: number;
  chestYaw: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  fl: number;
  fr: number;
  bl: number;
  br: number;
  flRoll: number;
  frRoll: number;
  /** Tail base lift (+ = up). */
  tailLift: number;
  /** Per-segment curl up (+) / down (-). */
  tailCurl: number;
  /** Per-segment sideways curl (wraps round the body). */
  tailSide: number;
  /** Sway amplitude per segment. */
  tailWag: number;
  /** Sway speed (Hz-ish). */
  tailSpeed: number;
  /** 1 open .. 0 closed. */
  eyes: number;
  /** Breathing depth multiplier. */
  breath: number;
}

export type PoseKey = keyof CatPose;
export const POSE_KEYS: PoseKey[] = [
  'hipsY', 'hipsZ', 'hipsPitch', 'hipsRoll', 'chestPitch', 'chestYaw', 'headPitch', 'headYaw', 'headRoll',
  'fl', 'fr', 'bl', 'br', 'flRoll', 'frRoll', 'tailLift', 'tailCurl', 'tailSide', 'tailWag', 'tailSpeed', 'eyes', 'breath',
];

export function zeroPose(): CatPose {
  return {
    hipsY: 0, hipsZ: 0, hipsPitch: 0, hipsRoll: 0, chestPitch: 0, chestYaw: 0,
    headPitch: -0.18, headYaw: 0, headRoll: 0, fl: 0, fr: 0, bl: 0, br: 0, flRoll: 0, frRoll: 0,
    tailLift: 0, tailCurl: 0.2, tailSide: 0, tailWag: 0.12, tailSpeed: 0.6, eyes: 1, breath: 1,
  };
}

export type CatAnim = 'idle' | 'walk' | 'sit' | 'sleep' | 'stretch' | 'play' | 'eat' | 'groom';

type PoseFn = (p: CatPose, t: number, seed: number) => void;

/** Sitting base shared by sit / groom / play. */
function sitBase(p: CatPose): void {
  p.hipsY = -0.052;
  p.hipsZ = -0.012;
  p.hipsPitch = -0.62;
  p.fl = p.fr = 0.62;
  p.bl = p.br = -0.95;
  p.headPitch = 0.5;
  p.tailLift = -0.55;
  p.tailCurl = -0.02;
  p.tailSide = 0.2;
  p.tailWag = 0.05;
}

export const POSES: Record<CatAnim, PoseFn> = {
  idle(p, t, seed) {
    p.headYaw = Math.sin(t * 0.45 + seed) * 0.35;
    p.headPitch = -0.18 + Math.sin(t * 0.31 + seed * 2) * 0.1;
    p.headRoll = Math.sin(t * 0.23 + seed) * 0.08;
    p.tailLift = 0.15;
    p.tailWag = 0.14;
  },
  walk(p, t) {
    const ph = t * 7.5;
    const s = Math.sin(ph);
    p.fl = s * 0.55;
    p.br = s * 0.55;
    p.fr = -s * 0.55;
    p.bl = -s * 0.55;
    p.hipsY = Math.abs(Math.cos(ph)) * 0.007 - 0.004;
    p.hipsRoll = Math.sin(ph) * 0.04;
    p.headPitch = Math.cos(ph * 2) * 0.03 - 0.04;
    p.tailLift = 0.35;
    p.tailCurl = 0.16;
    p.tailWag = 0.1;
    p.tailSpeed = 1.2;
  },
  sit(p, t, seed) {
    sitBase(p);
    p.headYaw = Math.sin(t * 0.4 + seed) * 0.3;
    p.headRoll = Math.sin(t * 0.27 + seed) * 0.1;
  },
  sleep(p, t) {
    p.hipsY = -0.074;
    p.fl = p.fr = -1.45;
    p.bl = p.br = -1.5;
    p.hipsRoll = 0.18;
    p.chestYaw = 0.7;
    p.headYaw = 0.75;
    p.headPitch = 0.3;
    p.headRoll = 0.35;
    p.tailLift = -0.85;
    p.tailCurl = -0.02;
    p.tailSide = 0.42;
    p.tailWag = 0.02;
    p.tailSpeed = 0.25;
    p.eyes = 0;
    p.breath = 1.8 + Math.sin(t * 0.2) * 0.2;
  },
  stretch(p, t) {
    // Play-dough "downward cat": front low and paws forward, rear up.
    const k = Math.min(1, Math.sin(Math.min(t / 2.6, 1) * Math.PI) * 1.4);
    p.hipsPitch = 0.34 * k;
    p.hipsY = -0.012 * k;
    p.fl = p.fr = -1.05 * k;
    p.bl = p.br = -0.34 * k;
    p.headPitch = -0.45 * k;
    p.tailLift = 0.7 * k;
    p.tailCurl = 0.02;
    p.tailWag = 0.04;
    p.eyes = 1 - 0.75 * k;
  },
  play(p, t) {
    sitBase(p);
    p.hipsPitch = -0.38;
    p.hipsY = -0.03 - Math.abs(Math.sin(t * 4)) * 0.006;
    p.fl = 0.4;
    p.fr = 0.4;
    p.bl = p.br = -0.6;
    // Alternate swipes with the front paws.
    const left = Math.sin(t * 2.4) > 0;
    const swipe = -1.5 + Math.sin(t * 11) * 0.45;
    if (left) {
      p.fl = swipe;
      p.flRoll = -0.35;
    } else {
      p.fr = swipe;
      p.frRoll = 0.35;
    }
    p.headPitch = 0.15 + Math.sin(t * 5) * 0.08;
    p.headRoll = Math.sin(t * 1.3) * 0.3;
    p.headYaw = Math.sin(t * 2.4) * 0.25;
    p.tailLift = 0.15;
    p.tailWag = 0.32;
    p.tailSpeed = 2.4;
  },
  eat(p, t) {
    p.hipsPitch = 0.16;
    p.hipsY = -0.006;
    p.fl = p.fr = -0.16;
    p.bl = p.br = -0.16;
    p.chestPitch = 0.18;
    p.headPitch = 0.7 + Math.sin(t * 9) * 0.07;
    p.tailLift = 0.05;
    p.tailWag = 0.07;
    p.eyes = 0.55;
  },
  groom(p, t) {
    sitBase(p);
    const lick = Math.sin(t * 7);
    p.fl = -1.75 + lick * 0.08;
    p.flRoll = -0.55;
    p.headPitch = 0.85 + lick * 0.1;
    p.headYaw = -0.32;
    p.headRoll = -0.15;
    p.eyes = 0.15;
  },
};
