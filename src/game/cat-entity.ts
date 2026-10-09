import * as THREE from 'three';
import type { CatActivityId } from '../config/cats';
import { cachedGeometry, mesh, pastel } from '../core/cache';
import { blobShadow } from '../models/blob-shadow';
import { CatAnimator } from '../models/cat/cat-animator';
import { buildCat, CAT_SCALE, type CatModel } from '../models/cat/cat-builder';
import { MeowBubble } from '../models/cat/meow-bubble';
import { CatBehavior, type RoamArea } from './cat-behavior';
import type { CatData } from './cat-data';

const WALK_SPEED = 0.38;
const TURN_RATE = 5;
const tmp = new THREE.Vector3();

function foodBowl(): THREE.Group {
  const g = new THREE.Group();
  const bowl = mesh(
    cachedGeometry('cat-bowl', () =>
      new THREE.LatheGeometry(
        [new THREE.Vector2(0, 0), new THREE.Vector2(0.07, 0), new THREE.Vector2(0.085, 0.045), new THREE.Vector2(0.075, 0.05), new THREE.Vector2(0.06, 0.02), new THREE.Vector2(0, 0.02)],
        20,
      ),
    ),
    pastel('#ff9fb5', 0.5),
  );
  const food = mesh(cachedGeometry('cat-bowl-food', () => new THREE.SphereGeometry(0.06, 14, 8, 0, Math.PI * 2, 0, 1.1)), pastel('#b97a4a', 0.9));
  food.position.y = 0.0;
  food.scale.y = 0.6;
  g.add(bowl, food);
  return g;
}

function yarnBall(): THREE.Mesh {
  const m = mesh(cachedGeometry('yarn', () => new THREE.IcosahedronGeometry(0.045, 2)), pastel('#9fd8ff', 0.8));
  return m;
}

/**
 * A live cat in the world: model + animator + behaviour + meow bubble, plus
 * an invisible hit sphere for the centre-screen raycast.
 */
export class CatEntity {
  readonly model: CatModel;
  readonly animator: CatAnimator;
  readonly behavior: CatBehavior;
  readonly bubble = new MeowBubble();
  /** Raycast target (invisible). */
  readonly hitProxy: THREE.Mesh;
  readonly group = new THREE.Group();
  private readonly bowl = foodBowl();
  private readonly ball = yarnBall();
  private heading = Math.random() * Math.PI * 2;
  private playT = 0;
  private readonly headPos = new THREE.Vector3();

  constructor(
    readonly data: CatData,
    area: RoamArea,
    start: THREE.Vector3,
  ) {
    this.model = buildCat(data.appearance);
    this.animator = new CatAnimator(this.model);
    this.behavior = new CatBehavior(data.personality, area);

    const s = data.appearance.size * CAT_SCALE;
    this.hitProxy = new THREE.Mesh(
      cachedGeometry('cat-hit', () => new THREE.SphereGeometry(1, 8, 6)),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.hitProxy.scale.set(0.16 * s, 0.17 * s, 0.24 * s);
    this.hitProxy.position.y = 0.17 * s;
    this.model.root.add(this.hitProxy);
    // Root is already scaled by s, so the shadow uses unscaled size.
    this.model.root.add(blobShadow(0.42, 0.6, 0.7));

    this.bowl.visible = false;
    this.ball.visible = false;
    this.group.add(this.model.root, this.bubble.sprite, this.bowl, this.ball);
    this.model.mesh.userData.outline = 0.006;
    this.model.root.position.copy(start);
    this.model.root.rotation.y = this.heading;
  }

  get position(): THREE.Vector3 {
    return this.model.root.position;
  }

  /** Player interaction: a quick play session + a happy meow. */
  play(): void {
    this.behavior.interrupt('play', this.position, 4);
    this.animator.play('play');
    this.meow();
  }

  meow(): void {
    this.bubble.show();
    this.animator.meow();
  }

  force(activity: CatActivityId | null): void {
    this.behavior.forced = activity;
    if (activity) {
      this.behavior.start(activity, this.position);
      this.animator.play(activity);
    }
  }

  update(dt: number): void {
    const { changed, meow } = this.behavior.update(dt, this.position);
    const act = this.behavior.activity;
    if (changed || this.animator.anim !== act) this.animator.play(act);
    if (meow) this.meow();

    if (act === 'walk') this.walk(dt);
    this.updateProps(dt, act);
    this.animator.update(dt);

    // Bubble floats above the head.
    this.model.bones.head.getWorldPosition(this.headPos);
    this.headPos.y += 0.3 * this.data.appearance.size;
    this.bubble.update(dt, this.headPos);
  }

  private walk(dt: number): void {
    const root = this.model.root;
    tmp.subVectors(this.behavior.target, root.position);
    tmp.y = 0;
    const dist = tmp.length();
    if (dist < 1e-3) return;
    const want = Math.atan2(tmp.x, tmp.z);
    let d = want - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * Math.min(1, dt * TURN_RATE);
    root.rotation.y = this.heading;
    // Slow down while turning hard, so cats don't moonwalk sideways.
    const speed = WALK_SPEED * Math.max(0.2, Math.cos(d));
    const step = Math.min(dist, speed * dt);
    root.position.x += Math.sin(this.heading) * step;
    root.position.z += Math.cos(this.heading) * step;
  }

  private updateProps(dt: number, act: CatActivityId): void {
    const root = this.model.root;
    const s = this.data.appearance.size * CAT_SCALE;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.bowl.visible = act === 'eat';
    if (this.bowl.visible) this.bowl.position.set(root.position.x + fx * 0.3 * s, root.position.y, root.position.z + fz * 0.3 * s);
    this.ball.visible = act === 'play';
    if (this.ball.visible) {
      this.playT += dt;
      const side = Math.sin(this.playT * 2.4) * 0.08 * s;
      this.ball.position.set(
        root.position.x + fx * 0.28 * s + fz * side,
        root.position.y + 0.045 + Math.abs(Math.sin(this.playT * 5)) * 0.05,
        root.position.z + fz * 0.28 * s - fx * side,
      );
      this.ball.rotation.x += dt * 6;
    }
  }
}
