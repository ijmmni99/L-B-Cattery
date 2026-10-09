import * as THREE from 'three';

export interface Interactable {
  /** World position of the object's base (used for markers). */
  position: THREE.Vector3;
  /**
   * Mesh(es) the centre ray must hit. Omit for "ambient" actions such as
   * Place, which apply whenever no object is targeted.
   */
  object?: THREE.Object3D;
  /** What to outline when targeted (defaults to `object`). */
  highlight?: THREE.Object3D;
  /** Button label, or null when this can't be used right now. */
  label(): string | null;
  act(): void;
}

/** Max distance from the eye to an object to use it. */
export const REACH = 2.5;

const CENTER = new THREE.Vector2(0, 0);

/**
 * Raycasts from the screen centre each frame. The nearest hit interactable
 * within reach wins; otherwise the first available ambient action applies.
 */
export class InteractionSystem {
  private readonly items = new Set<Interactable>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly owners = new Map<THREE.Object3D, Interactable>();
  private readonly targets: THREE.Object3D[] = [];
  private readonly hits: THREE.Intersection[] = [];
  current: Interactable | null = null;

  constructor() {
    this.raycaster.far = REACH;
  }

  add(item: Interactable): void {
    this.items.add(item);
  }

  remove(item: Interactable): void {
    this.items.delete(item);
    if (this.current === item) this.current = null;
  }

  update(camera: THREE.Camera): Interactable | null {
    this.targets.length = 0;
    this.owners.clear();
    let ambient: Interactable | null = null;
    for (const item of this.items) {
      if (item.label() === null) continue;
      if (item.object) {
        this.targets.push(item.object);
        this.owners.set(item.object, item);
      } else if (!ambient) {
        ambient = item;
      }
    }

    let best: Interactable | null = null;
    if (this.targets.length) {
      this.raycaster.setFromCamera(CENTER, camera);
      this.hits.length = 0;
      this.raycaster.intersectObjects(this.targets, true, this.hits);
      for (const hit of this.hits) {
        best = this.ownerOf(hit.object);
        if (best) break;
      }
    }
    this.current = best ?? ambient;
    return this.current;
  }

  /** The object to highlight (null for ambient actions). */
  get highlightTarget(): THREE.Object3D | null {
    return this.current?.highlight ?? this.current?.object ?? null;
  }

  trigger(): boolean {
    if (!this.current || this.current.label() === null) return false;
    this.current.act();
    return true;
  }

  private ownerOf(obj: THREE.Object3D): Interactable | null {
    let o: THREE.Object3D | null = obj;
    while (o) {
      const owner = this.owners.get(o);
      if (owner) return owner;
      o = o.parent;
    }
    return null;
  }
}
