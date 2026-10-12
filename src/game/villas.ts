import * as THREE from 'three';
import { BREED_BY_ID, RARITIES } from '../config/cats';
import { ADOPTION_FACTOR } from '../config/progression';
import { VILLA_SIZE, VILLA_TINTS, type VillaSpot } from '../config/villas';
import { haptic } from '../core/haptics';
import { mergeStatic } from '../core/merge-static';
import { buildVilla, type VillaModel } from '../models/villa-model';
import type { CollisionWorld } from '../world/colliders';
import { catValue, type CatData } from './cat-data';
import { CatEntity } from './cat-entity';
import { NO_OUTLINE, type InfoCardData, type Interactable, type InteractionSystem } from './interactions';

const ROAM_RADIUS = 0.5;
const EMPTY_LABEL = 'Empty';

export class Villa {
  cat: CatEntity | null = null;
  /** A customer is on their way to adopt this cat. */
  reserved = false;
  removed = false;
  catItem: Interactable | null = null;
  item: Interactable | null = null;
  colliderId = -1;
  readonly model: VillaModel;
  /** Identity wrapper holding the merged frame; `group` carries the transform. */
  readonly root = new THREE.Group();
  readonly group = new THREE.Group();
  readonly pickBox: THREE.Mesh;
  readonly area = { center: new THREE.Vector3(), radius: ROAM_RADIUS };

  constructor(readonly spot: VillaSpot, tint: string) {
    this.model = buildVilla(tint);
    this.group.position.set(spot.x, 0, spot.z);
    this.group.rotation.y = spot.yaw;
    this.group.add(this.model.frame, this.model.plate, this.model.proxy);
    this.root.add(this.group);
    this.root.updateMatrixWorld(true);
    this.root.add(mergeStatic(this.root));
    this.area.center.set(spot.x + Math.sin(spot.yaw) * 0.1, VILLA_SIZE.platform, spot.z + Math.cos(spot.yaw) * 0.1);
    this.pickBox = new THREE.Mesh(
      new THREE.BoxGeometry(VILLA_SIZE.w, 1.6, VILLA_SIZE.d),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.pickBox.position.set(spot.x, 0.8, spot.z);
    this.pickBox.rotation.y = spot.yaw;
    this.pickBox.updateMatrixWorld(true);
  }

  /** Floor spot in front of the villa where a visitor stands to look at its cat. */
  standPoint(out: THREE.Vector3): THREE.Vector3 {
    const { x, z, yaw } = this.spot;
    const d = VILLA_SIZE.d / 2 + 0.6;
    return out.set(x + Math.sin(yaw) * d, 0, z + Math.cos(yaw) * d);
  }
}

/** The cat villas: placed from build mode, filled from the shelter, played with by the player. */
export class VillaManager {
  readonly villas: Villa[] = [];
  /** Invisible boxes build mode raycasts to select a villa. */
  readonly pickables = new THREE.Group();
  private readonly root = new THREE.Group();
  private tintIndex = 0;

  constructor(
    scene: THREE.Scene,
    private readonly colliders: CollisionWorld,
    private readonly interactions: InteractionSystem,
    /** Called when the player wants to pick a cat for an empty villa. */
    private readonly onChooseCat: (villa: Villa) => void,
  ) {
    scene.add(this.root, this.pickables);
  }

  static adoptionFee(cat: CatData): number {
    return Math.round(catValue(cat) * ADOPTION_FACTOR);
  }

  /** Footprint after rotation, for collisions. */
  static footprint(yaw: number): { w: number; d: number } {
    const alongX = Math.abs(Math.sin(yaw)) < 0.5;
    const w = VILLA_SIZE.w + 0.05;
    const d = VILLA_SIZE.d + 0.05;
    return alongX ? { w, d } : { w: d, d: w };
  }

  addVilla(spot: VillaSpot, cat: CatData | null = null): Villa {
    const villa = new Villa(spot, VILLA_TINTS[this.tintIndex++ % VILLA_TINTS.length]);
    this.villas.push(villa);
    this.root.add(villa.root);
    this.pickables.add(villa.pickBox);
    villa.pickBox.userData.placed = { kind: 'villa', villa };
    const fp = VillaManager.footprint(spot.yaw);
    villa.colliderId = this.colliders.addCentered(spot.x, spot.z, fp.w, fp.d);
    this.register(villa);
    if (cat) this.assignCat(villa, cat, false);
    return villa;
  }

  /** Takes a villa out of the shop; returns the cat that lived there (if any). */
  removeVilla(villa: Villa): CatData | null {
    const data = villa.cat?.data ?? null;
    villa.removed = true;
    villa.reserved = false;
    villa.cat?.group.removeFromParent();
    if (villa.item) this.interactions.remove(villa.item);
    if (villa.catItem) this.interactions.remove(villa.catItem);
    this.colliders.remove(villa.colliderId);
    villa.root.removeFromParent();
    villa.pickBox.removeFromParent();
    this.villas.splice(this.villas.indexOf(villa), 1);
    return data;
  }

  /** Villas with a cat nobody has claimed yet. */
  adoptable(): Villa[] {
    return this.villas.filter((v) => v.cat && !v.reserved);
  }

  /** Cat leaves with its new family. */
  releaseCat(villa: Villa): void {
    const cat = villa.cat;
    if (!cat) return;
    cat.group.removeFromParent();
    if (villa.catItem) this.interactions.remove(villa.catItem);
    villa.cat = null;
    villa.catItem = null;
    villa.reserved = false;
    villa.model.setLabel(EMPTY_LABEL);
  }

  serialize(): Array<{ id: string; cat: CatData | null }> {
    return this.villas.map((v) => ({ id: v.spot.id, cat: v.cat?.data ?? null }));
  }

  get catCount(): number {
    return this.villas.filter((v) => v.cat).length;
  }

  update(dt: number): void {
    for (const v of this.villas) v.cat?.update(dt);
  }

  /** Moves a cat into a villa. */
  assignCat(villa: Villa, data: CatData, announce = true): void {
    if (villa.cat) return;
    const cat = new CatEntity(data, villa.area, villa.area.center.clone());
    villa.cat = cat;
    this.root.add(cat.group);
    villa.model.setLabel(data.name);
    if (announce) cat.meow();
    villa.catItem = this.addCatInteraction(cat);
  }

  private register(villa: Villa): void {
    const item: Interactable = {
      position: villa.group.position,
      object: villa.model.proxy,
      highlight: NO_OUTLINE,
      label: () => (villa.cat ? null : 'Choose a cat'), // with a cat, the cat itself is the target
      act: () => this.onChooseCat(villa),
      info: (): InfoCardData | null => ({ key: `${villa.spot.id}:empty`, title: 'Empty villa', sub: 'Ready for a new cat', tag: 'Tap to choose a cat' }),
    };
    villa.item = item;
    this.interactions.add(item);
  }

  private addCatInteraction(cat: CatEntity): Interactable {
    const item: Interactable = {
      position: cat.position,
      object: cat.hitProxy,
      highlight: cat.model.mesh,
      label: () => 'Play',
      info: () => {
        const breed = BREED_BY_ID[cat.data.appearance.breedId];
        const r = RARITIES[cat.data.rarity];
        return {
          key: cat.data.id,
          title: cat.data.name,
          badge: { text: r.label, color: r.color },
          sub: `${breed?.name ?? ''} · ${breed?.coats[cat.data.appearance.coatIndex]?.name ?? ''}`,
          tag: `${cat.data.personality} · adoption $${VillaManager.adoptionFee(cat.data)}`,
        };
      },
      act: () => {
        cat.play();
        haptic([12, 40, 12]);
      },
    };
    this.interactions.add(item);
    return item;
  }
}
