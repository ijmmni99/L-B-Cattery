import * as THREE from 'three';
import { BREED_BY_ID, BREEDS, type EarType } from '../../config/cats';
import { cachedGeometry } from '../../core/cache';
import { fbm3, smoothstep } from '../../core/noise';
import type { CatAppearance } from '../../game/cat-data';
import { partMaterial } from '../part-builder';
import { catDims, type CatDims, type V3 } from './cat-anatomy';
import { CoatPainter } from './cat-coat';
import { SkinnedPartBuilder, trs, type DisplaceFn } from './skinned-builder';

/** Visual scale on top of breed size: chibi cats read better in first person. */
export const CAT_SCALE = 1.3;

export const BONE = {
  root: 0,
  hips: 1,
  chest: 2,
  head: 3,
  eyes: 4,
  legFL: 5,
  legFR: 6,
  legBL: 7,
  legBR: 8,
  tail0: 9,
} as const;

export interface CatBones {
  root: THREE.Bone;
  hips: THREE.Bone;
  chest: THREE.Bone;
  head: THREE.Bone;
  eyes: THREE.Bone;
  legFL: THREE.Bone;
  legFR: THREE.Bone;
  legBL: THREE.Bone;
  legBR: THREE.Bone;
  tail: THREE.Bone[];
}

export interface CatModel {
  /** Place / rotate this in the world. */
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  bones: CatBones;
  dims: CatDims;
}

const geo = {
  sphere: () => cachedGeometry('cat-sphere', () => new THREE.SphereGeometry(1, 22, 16)),
  smallSphere: () => cachedGeometry('cat-sphere-s', () => new THREE.SphereGeometry(1, 12, 9)),
  capsule: (r: number, l: number) => cachedGeometry(`cat-cap:${r.toFixed(4)}:${l.toFixed(4)}`, () => new THREE.CapsuleGeometry(r, l, 8, 18)),
  cone: () => cachedGeometry('cat-cone', () => new THREE.ConeGeometry(1, 1, 18, 3)),
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function makeBones(d: CatDims): CatBones {
  const bone = (pos: V3, parent?: THREE.Bone): THREE.Bone => {
    const b = new THREE.Bone();
    b.position.set(pos[0], pos[1], pos[2]);
    parent?.add(b);
    return b;
  };
  const root = bone([0, 0, 0]);
  const hips = bone(d.hips, root);
  const chest = bone(sub(d.chest, d.hips), hips);
  const head = bone(sub(d.head, d.chest), chest);
  const eyes = bone([0, d.headR * 0.02, d.headR * 0.8], head);
  const [fx, fy, fz] = d.legFront;
  const [bx, by, bz] = d.legBack;
  const legFL = bone(sub([-fx, fy, fz], d.chest), chest);
  const legFR = bone(sub([fx, fy, fz], d.chest), chest);
  const legBL = bone(sub([-bx, by, bz], d.hips), hips);
  const legBR = bone(sub([bx, by, bz], d.hips), hips);
  const tail: THREE.Bone[] = [bone(sub(d.tailBase, d.hips), hips)];
  tail[0].rotation.x = d.tailPitch;
  for (let i = 1; i < d.tailSegs; i++) tail.push(bone([0, d.tailSegLen, 0], tail[i - 1]));
  return { root, hips, chest, head, eyes, legFL, legFR, legBL, legBR, tail };
}

/** Builds a cat as a single skinned mesh from its appearance data. */
export function buildCat(app: CatAppearance): CatModel {
  const breed = BREED_BY_ID[app.breedId] ?? BREEDS[0];
  const coat = breed.coats[app.coatIndex] ?? breed.coats[0];
  const d = catDims(breed);
  const painter = new CoatPainter(coat, d, app.seed);
  const bones = makeBones(d);
  bones.root.updateMatrixWorld(true);

  const fluff = breed.fluff;
  const fur: DisplaceFn = (p) =>
    fluff > 0 ? (fbm3(p.x * 90, p.y * 90, p.z * 90, app.seed + 7) - 0.45) * 0.01 * fluff + 0.006 * fluff : 0;
  const lightFur: DisplaceFn = (p) => fur(p) * 0.45;
  const b = new SkinnedPartBuilder();
  const R = d.bodyR * (1 + 0.1 * fluff);

  // ---- Body: hips/chest blended along Z so the spine can bend. ----
  const spine = (p: THREE.Vector3): [number, number, number] => [
    BONE.hips,
    BONE.chest,
    smoothstep(d.hips[2] - 0.01, d.chest[2] + 0.01, p.z),
  ];
  b.add(geo.capsule(R, d.bodyLen), trs([0, d.bodyY, 0], [Math.PI / 2, 0, 0], [1, 1, 0.94]), painter.fn('body'), spine, fur);
  for (const s of [-1, 1]) {
    b.add(geo.sphere(), trs([s * d.legBack[0] * 0.9, d.bodyY - 0.012, d.hips[2] - 0.012], [0, 0, 0], R * 0.68), painter.fn('body'), BONE.hips, fur);
  }
  const ruffR = R * (fluff > 0.5 ? 1.02 : 0.88);
  b.add(geo.sphere(), trs([0, d.bodyY + 0.022, d.chest[2] + 0.025], [0, 0, 0], ruffR), painter.fn('ruff'), BONE.chest, fur);

  addHead(b, d, painter, breed.ears, breed.muzzle, lightFur, fluff);
  addEyes(b, d, app);

  // ---- Legs ----
  const legs: Array<[number, V3, number, boolean]> = [
    [BONE.legFL, [-d.legFront[0], d.legFront[1], d.legFront[2]], d.frontLegLen, true],
    [BONE.legFR, [d.legFront[0], d.legFront[1], d.legFront[2]], d.frontLegLen, true],
    [BONE.legBL, [-d.legBack[0], d.legBack[1], d.legBack[2]], d.backLegLen, false],
    [BONE.legBR, [d.legBack[0], d.legBack[1], d.legBack[2]], d.backLegLen, false],
  ];
  const legR = 0.026 * breed.build * (1 + 0.15 * fluff);
  for (const [bi, top, len, front] of legs) {
    const capLen = Math.max(len - 0.045, 0.02);
    b.add(geo.capsule(legR, capLen), trs([top[0], top[1] - capLen / 2 - 0.006, top[2]]), painter.fn('leg'), bi, lightFur);
    b.add(geo.sphere(), trs([top[0], 0.019, top[2] + 0.012], [0, 0, 0], [0.031, 0.02, 0.04]), painter.fn('paw'), bi);
    if (front) b.add(geo.sphere(), trs([top[0], top[1] - 0.005, top[2]], [0, 0, 0], legR * 1.35), painter.fn('leg'), bi, lightFur);
  }

  addTail(b, d, bones, painter, fur);

  const geometry = b.build();
  const mesh = new THREE.SkinnedMesh(geometry, partMaterial());
  mesh.castShadow = true;
  mesh.frustumCulled = false; // bones move it far from the bind-pose bounds
  const root = new THREE.Group();
  root.add(bones.root, mesh);
  const list: THREE.Bone[] = [];
  bones.root.traverse((o) => {
    if (o instanceof THREE.Bone) list.push(o);
  });
  // Bone order must match the BONE indices used for skin weights.
  const ordered = [bones.root, bones.hips, bones.chest, bones.head, bones.eyes, bones.legFL, bones.legFR, bones.legBL, bones.legBR, ...bones.tail];
  if (ordered.length !== list.length) throw new Error('cat skeleton mismatch');
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(ordered));
  root.scale.setScalar(app.size * CAT_SCALE);
  return { root, mesh, bones, dims: d };
}

function addHead(
  b: SkinnedPartBuilder,
  d: CatDims,
  painter: CoatPainter,
  ears: EarType,
  muzzle: string,
  fur: DisplaceFn,
  fluff: number,
): void {
  const H = d.head;
  const HR = d.headR;
  const at = (x: number, y: number, z: number): V3 => add(H, [x * HR, y * HR, z * HR]);
  const head = BONE.head;
  const dark = painter.isDark;

  b.add(geo.sphere(), trs(H, [0, 0, 0], [HR * 1.1, HR * 0.96, HR * 0.95]), painter.fn('head'), head, fur);
  const cheekR = HR * (fluff > 0.5 ? 0.58 : 0.5);
  for (const s of [-1, 1]) {
    b.add(geo.sphere(), trs(at(s * 0.48, -0.3, 0.32), [0, 0, 0], cheekR), painter.fn('cheek'), head, fur);
  }
  const mz = muzzle === 'flat' ? 0.7 : muzzle === 'long' ? 0.86 : 0.78;
  const my = muzzle === 'long' ? -0.4 : -0.36;
  for (const s of [-1, 1]) {
    b.add(geo.sphere(), trs(at(s * 0.155, my, mz), [0, 0, 0], HR * 0.27), painter.fn('muzzle'), head);
  }
  b.add(geo.sphere(), trs(at(0, my - 0.18, mz - 0.08), [0, 0, 0], HR * 0.2), painter.fn('chin'), head);
  b.add(geo.smallSphere(), trs(at(0, my + 0.16, mz + 0.17), [0, 0, 0], [HR * 0.11, HR * 0.075, HR * 0.08]), dark ? '#4b3e46' : '#f29aa8', head);
  for (const s of [-1, 1]) {
    b.add(geo.capsule(0.0032, HR * 0.1), trs(at(s * 0.075, my - 0.07, mz + 0.2), [0, 0, s * 0.95]), '#6b4a55', head);
  }

  // Whiskers: three per side, fanning out from the muzzle.
  const whisker = dark ? '#f4f1ec' : '#cfc6bc';
  const wl = HR * 0.8;
  for (const s of [-1, 1]) {
    for (let k = -1; k <= 1; k++) {
      const base = at(s * 0.3, my + k * 0.06, mz + 0.08);
      const rz = Math.PI / 2 + s * k * 0.16;
      const center = add(base, [s * wl * 0.48, -k * 0.004, -wl * 0.12]);
      b.add(geo.capsule(0.0015, wl), trs(center, [0, s * 0.25, rz]), whisker, head);
    }
  }

  // Ears: rounded cones flattened front-to-back, with pink inner cones.
  const size = { normal: [0.78, 0.44], big: [1.0, 0.52], small: [0.56, 0.38], folded: [0.48, 0.4], tufted: [0.84, 0.45] }[ears];
  const [h, r] = [size[0] * HR, size[1] * HR];
  const inner = dark ? '#b77f8c' : '#f6b3be';
  for (const s of [-1, 1]) {
    const folded = ears === 'folded';
    const pos = folded ? at(s * 0.48, 0.78, 0.1) : at(s * 0.56, 0.86, -0.04);
    const rot: V3 = folded ? [1.3, 0, -s * 0.45] : [-0.08, 0, -s * 0.42];
    const earM = trs(pos, rot, [r, h, r * 0.55]);
    b.add(geo.cone(), earM, painter.fn('ear'), head);
    const innerM = earM.clone().multiply(trs([0, -0.08, 0.45], [0, 0, 0], [0.62, 0.72, 0.5]));
    b.add(geo.cone(), innerM, inner, head);
    if (ears === 'tufted') {
      b.add(geo.cone(), earM.clone().multiply(trs([0, 0.62, 0], [0, 0, 0], [0.22, 0.4, 0.3])), painter.fn('ear'), head);
    }
  }
}

function addEyes(b: SkinnedPartBuilder, d: CatDims, app: CatAppearance): void {
  const HR = d.headR;
  for (const s of [-1, 1]) {
    const center = add(d.head, [s * HR * 0.42, HR * 0.02, HR * 0.8]);
    const eye = trs(center, [0, s * 0.38, 0]);
    const part = (off: V3, scale: V3 | number, color: string, g = geo.sphere()): void => {
      b.add(g, eye.clone().multiply(trs(off, [0, 0, 0], scale)), color, BONE.eyes);
    };
    part([0, 0, 0], [HR * 0.26, HR * 0.29, HR * 0.13], s < 0 ? app.eyeLeft : app.eyeRight);
    part([0, 0, HR * 0.05], [HR * 0.15, HR * 0.2, HR * 0.1], '#1d1820');
    part([-HR * 0.07, HR * 0.1, HR * 0.12], HR * 0.075, '#ffffff', geo.smallSphere());
    part([HR * 0.06, -HR * 0.08, HR * 0.11], HR * 0.035, '#ffffff', geo.smallSphere());
  }
}

function addTail(b: SkinnedPartBuilder, d: CatDims, bones: CatBones, painter: CoatPainter, fur: DisplaceFn): void {
  const len = d.tailSegLen * d.tailSegs;
  const [rBase, rTip] = d.tailRadius;
  const tube = cachedGeometry(`cat-tail:${len}:${rBase}:${rTip}`, () => {
    const g = new THREE.CylinderGeometry(rTip, rBase, len, 12, 24, true);
    g.translate(0, len / 2, 0);
    return g;
  });
  const m = bones.tail[0].matrixWorld.clone();
  const base = new THREE.Vector3().setFromMatrixPosition(m);
  const dir = new THREE.Vector3(0, 1, 0).transformDirection(m);
  const tmp = new THREE.Vector3();
  const skin = (p: THREE.Vector3): [number, number, number] => {
    const along = tmp.subVectors(p, base).dot(dir) / d.tailSegLen;
    const i = Math.min(Math.max(Math.floor(along), 0), d.tailSegs - 1);
    const next = Math.min(i + 1, d.tailSegs - 1);
    const w = smoothstep(0.55, 1, along - i) * 0.5;
    return [BONE.tail0 + i, BONE.tail0 + next, w];
  };
  b.add(tube, m, painter.fn('tail'), skin, fur);
  b.add(geo.sphere(), m.clone().multiply(trs([0, len, 0], [0, 0, 0], rTip)), painter.fn('tail'), skin, fur);
}
