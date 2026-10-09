import * as THREE from 'three';
import { cachedGeometry } from '../core/cache';
import { blobShadow } from './blob-shadow';
import { addFace, addHair, HAIR_STYLES, HEAD_RADIUS, shapes, type HairStyle } from './character-parts';
import { PartBuilder, partMaterial } from './part-builder';

export interface CharacterParams {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  accent: string;
  shirt: string;
  pants: string;
  shoes: string;
  /** Overall scale, ~0.92..1.08. */
  height: number;
  apron?: string;
}

export const SKIN_TONES = ['#ffe0c7', '#f6caa6', '#e5a882', '#c98b62', '#9c6644', '#6e4630'];
export const HAIR_COLORS = ['#2f2620', '#5a3b28', '#8a5a36', '#d9a35b', '#f0d48a', '#c8553d', '#7a7f8a', '#3b4a8a'];
const SHIRTS = ['#ff9fb5', '#8ec9ff', '#ffd27a', '#b8a6ff', '#9fe0b8', '#ff9f7a', '#f2f2f2', '#6fc3c9'];
const PANTS = ['#4b5d8a', '#3b3a4a', '#7a5c4a', '#5f7f6f', '#8a6fa8', '#c9b48f'];
const SHOES = ['#ffffff', '#3b3a4a', '#c8553d', '#5a3b28'];

function pick<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function randomCharacterParams(rand: () => number = Math.random): CharacterParams {
  return {
    skin: pick(SKIN_TONES, rand),
    hair: pick(HAIR_STYLES, rand),
    hairColor: pick(HAIR_COLORS, rand),
    accent: pick(SHIRTS, rand),
    shirt: pick(SHIRTS, rand),
    pants: pick(PANTS, rand),
    shoes: pick(SHOES, rand),
    height: 0.94 + rand() * 0.12,
  };
}

/** The shop owner: mint polo with a cream apron. */
export const PLAYER_PARAMS: CharacterParams = {
  skin: '#f6caa6',
  hair: 'ponytail',
  hairColor: '#5a3b28',
  accent: '#ff8fab',
  shirt: '#7fcfb8',
  pants: '#3b3a4a',
  shoes: '#ffffff',
  height: 1,
  apron: '#fff4e2',
};

const HIP_Y = 0.62;
const SHOULDER_Y = 1.16;
const HEAD_Y = 1.5;

function key(p: CharacterParams, part: string): string {
  return `char:${part}:${p.skin}:${p.hair}:${p.hairColor}:${p.accent}:${p.shirt}:${p.pants}:${p.shoes}:${p.apron ?? ''}`;
}

function buildTorso(p: CharacterParams): THREE.BufferGeometry {
  return cachedGeometry(key(p, 'torso'), () => {
    const b = new PartBuilder();
    b.add(shapes.capsule(0.21, 0.08), p.pants, [0, HIP_Y + 0.06, 0], [0, 0, 0], [1, 1, 0.85]);
    b.add(shapes.capsule(0.23, 0.26), p.shirt, [0, 0.95, 0], [0, 0, 0], [1, 1, 0.82]);
    b.add(shapes.cylinder(0.075, 0.085, 0.16), p.skin, [0, 1.26, 0]);
    if (p.apron) {
      b.add(shapes.capsule(0.2, 0.3), p.apron, [0, 0.86, 0.06], [0, 0, 0], [1.02, 1, 0.75]);
      b.add(shapes.sphere(), '#ff8fab', [0.08, 0.82, 0.21], [0, 0, 0], [0.05, 0.035, 0.02]);
    }
    return b.build();
  });
}

function buildHead(p: CharacterParams): THREE.BufferGeometry {
  return cachedGeometry(key(p, 'head'), () => {
    const b = new PartBuilder();
    const skin = new THREE.Color(p.skin);
    b.add(shapes.sphere(), skin, [0, 0, 0], [0, 0, 0], [HEAD_RADIUS, HEAD_RADIUS * 0.96, HEAD_RADIUS * 0.94]);
    addFace(b, skin);
    addHair(b, p.hair, p.hairColor, p.accent);
    return b.build();
  });
}

function buildArm(p: CharacterParams): THREE.BufferGeometry {
  return cachedGeometry(key(p, 'arm'), () => {
    const b = new PartBuilder();
    b.add(shapes.sphere(), p.shirt, [0, -0.02, 0], [0, 0, 0], 0.085);
    b.add(shapes.capsule(0.07, 0.3), p.shirt, [0, -0.2, 0]);
    b.add(shapes.sphere(), p.skin, [0, -0.43, 0], [0, 0, 0], 0.085);
    return b.build();
  });
}

function buildLeg(p: CharacterParams): THREE.BufferGeometry {
  return cachedGeometry(key(p, 'leg'), () => {
    const b = new PartBuilder();
    b.add(shapes.capsule(0.085, 0.36), p.pants, [0, -0.25, 0]);
    b.add(shapes.capsule(0.07, 0.1), p.shoes, [0, -0.55, 0.05], [Math.PI / 2, 0, 0], [1.15, 1, 0.8]);
    return b.build();
  });
}

/**
 * A procedural human. Rigid parts are single merged meshes on pivots, so one
 * character is 6 draw calls. Call `animate()` every frame.
 */
export class Character {
  readonly root = new THREE.Group();
  /** Attach carried objects here (in front of the chest). */
  readonly carryAnchor = new THREE.Object3D();
  private readonly body = new THREE.Group();
  private readonly head: THREE.Mesh;
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private phase = 0;
  private time = Math.random() * 10;
  private carryBlend = 0;
  carrying = false;

  constructor(params: CharacterParams) {
    const mat = partMaterial();
    const mk = (geo: THREE.BufferGeometry): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      return m;
    };
    this.body.add(mk(buildTorso(params)));
    this.head = mk(buildHead(params));
    this.head.position.y = HEAD_Y;
    this.body.add(this.head);

    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(side * 0.29, SHOULDER_Y, 0);
      arm.add(mk(buildArm(params)));
      this.body.add(arm);
    }
    for (const [leg, side] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(side * 0.11, HIP_Y, 0);
      leg.add(mk(buildLeg(params)));
      this.root.add(leg);
    }
    this.carryAnchor.position.set(0, 0.98, 0.42);
    this.body.add(this.carryAnchor);
    this.root.add(this.body);
    this.root.add(blobShadow(0.85, 0.85, 0.8));
    this.root.scale.setScalar(params.height);
  }

  /** `speed` in m/s drives stride; 0 = idle. */
  animate(dt: number, speed: number): void {
    this.time += dt;
    const moving = Math.min(speed / 3.5, 1);
    this.phase += dt * (4 + speed * 2.2);
    this.carryBlend += ((this.carrying ? 1 : 0) - this.carryBlend) * Math.min(dt * 10, 1);

    const swing = Math.sin(this.phase) * 0.75 * moving;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;

    const bob = Math.abs(Math.cos(this.phase)) * 0.05 * moving;
    const breathe = Math.sin(this.time * 2.2) * 0.012 * (1 - moving);
    this.body.position.y = bob;
    this.body.scale.y = 1 + breathe;
    this.body.rotation.z = Math.sin(this.phase) * 0.04 * moving;
    this.body.rotation.x = 0.06 * moving;
    this.head.rotation.y = Math.sin(this.time * 0.6) * 0.12 * (1 - moving);

    // Arms: swing while walking, reach forward while carrying.
    const armSwing = -swing * 0.8 * (1 - this.carryBlend);
    const carryPitch = -1.25 * this.carryBlend;
    this.armL.rotation.x = armSwing + carryPitch;
    this.armR.rotation.x = -armSwing + carryPitch;
    this.armL.rotation.z = -0.08 - 0.05 * (1 - moving) + 0.22 * this.carryBlend;
    this.armR.rotation.z = 0.08 + 0.05 * (1 - moving) - 0.22 * this.carryBlend;
  }
}
