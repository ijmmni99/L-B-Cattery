import * as THREE from 'three';
import { BREED_BY_ID, RARITIES } from '../config/cats';
import { ADOPTION_FACTOR } from '../config/progression';
import { VILLA_SIZE, VILLA_SPOTS, type VillaSpot } from '../config/villas';
import { haptic } from '../core/haptics';
import { mergeStatic } from '../core/merge-static';
import { buildVilla, type VillaModel } from '../models/villa-model';
import { toast } from '../ui/toast';
import type { CollisionWorld } from '../world/colliders';
import { catValue, type CatData } from './cat-data';
import { CatEntity } from './cat-entity';
import { NO_OUTLINE, type InfoCardData, type Interactable, type InteractionSystem } from './interactions';
import { spendMoney } from './state';

const ROAM_RADIUS = 0.5;

export class Villa {
  unlocked: boolean;
  cat: CatEntity | null = null;
  /** A customer is on their way to adopt this cat. */
  reserved = false;
  catItem: Interactable | null = null;
  readonly model: VillaModel;
  readonly group = new THREE.Group();
  readonly area = { center: new THREE.Vector3(), radius: ROAM_RADIUS };

  constructor(readonly spot: VillaSpot, readonly index: number) {
    this.unlocked = spot.unlockCost === 0;
    this.model = buildVilla(spot);
    this.group.position.set(spot.x, 0, spot.z);
    this.group.add(this.model.frame, this.model.plate, this.model.cover, this.model.proxy);
    this.model.cover.visible = !this.unlocked;
    this.model.setLabel(this.unlocked ? `Villa ${index + 1}` : `🔒 $${spot.unlockCost}`);
    this.area.center.set(spot.x, VILLA_SIZE.platform, spot.z + 0.1);
  }
}

/** The cat villas: buy more spots, move cats in, play with them. */
export class VillaManager {
  readonly villas: Villa[] = [];

  constructor(
    scene: THREE.Scene,
    colliders: CollisionWorld,
    private readonly interactions: InteractionSystem,
    /** Called when the player wants to pick a cat for an empty, unlocked villa. */
    private readonly onChooseCat: (villa: Villa) => void,
  ) {
    const frames = new THREE.Group();
    VILLA_SPOTS.forEach((spot, i) => {
      const villa = new Villa(spot, i);
      this.villas.push(villa);
      frames.add(villa.group);
      colliders.addCentered(spot.x, spot.z, VILLA_SIZE.w + 0.05, VILLA_SIZE.d + 0.05);
      this.register(villa);
    });
    frames.add(mergeStatic(frames));
    scene.add(frames);
    this.root = frames;
  }

  private readonly root: THREE.Group;

  /** Floor spot in front of a villa where a visitor stands to look at its cat. */
  static standPoint(villa: Villa, out: THREE.Vector3): THREE.Vector3 {
    return out.set(villa.spot.x, 0, villa.spot.z + VILLA_SIZE.d / 2 + 0.6);
  }

  static adoptionFee(cat: CatData): number {
    return Math.round(catValue(cat) * ADOPTION_FACTOR);
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
    villa.model.setLabel(`Villa ${villa.index + 1}`);
  }

  serialize(): Array<{ id: string; unlocked: boolean; cat: CatData | null }> {
    return this.villas.map((v) => ({ id: v.spot.id, unlocked: v.unlocked, cat: v.cat?.data ?? null }));
  }

  restore(saved: Array<{ id: string; unlocked: boolean; cat: CatData | null }>): void {
    for (const s of saved) {
      const villa = this.villas.find((v) => v.spot.id === s.id);
      if (!villa) continue;
      if (s.unlocked && !villa.unlocked) {
        villa.unlocked = true;
        villa.model.cover.visible = false;
        villa.model.setLabel(`Villa ${villa.index + 1}`);
      }
      if (s.cat && !villa.cat) this.assignCat(villa, s.cat, false);
    }
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
    const start = villa.area.center.clone();
    const cat = new CatEntity(data, villa.area, start);
    villa.cat = cat;
    this.root.add(cat.group);
    villa.model.setLabel(data.name);
    if (announce) cat.meow();
    villa.catItem = this.addCatInteraction(cat);
  }

  private tryUnlock(villa: Villa): void {
    if (villa.unlocked) return;
    if (!spendMoney(villa.spot.unlockCost)) {
      toast('Not enough money', 'bad');
      haptic([20, 40, 20]);
      return;
    }
    villa.unlocked = true;
    villa.model.cover.visible = false;
    villa.model.setLabel(`Villa ${villa.index + 1}`);
    toast(`Villa ${villa.index + 1} unlocked!`, 'good');
    haptic([10, 30, 14]);
  }

  private register(villa: Villa): void {
    const item: Interactable = {
      position: villa.group.position,
      object: villa.model.proxy,
      highlight: NO_OUTLINE,
      label: () => {
        if (villa.cat) return null; // the cat itself is the target
        return villa.unlocked ? 'Choose a cat' : `Unlock villa · $${villa.spot.unlockCost}`;
      },
      act: () => (villa.unlocked ? this.onChooseCat(villa) : this.tryUnlock(villa)),
      info: (): InfoCardData | null =>
        villa.unlocked
          ? { key: `${villa.spot.id}:empty`, title: `Villa ${villa.index + 1}`, sub: 'Empty · ready for a new cat', tag: 'Tap to choose a cat' }
          : { key: `${villa.spot.id}:locked`, title: `Villa ${villa.index + 1}`, sub: `Locked · $${villa.spot.unlockCost} to unlock`, tag: '🔒' },
    };
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
