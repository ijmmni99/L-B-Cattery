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
  /** Fired on press when the item has no `onPress` (one-shot actions). */
  act(): void;
  /** Press-and-hold actions (e.g. stocking): called on press... */
  onPress?(): void;
  /** ...and on release with how long it was held (seconds). */
  onRelease?(heldSeconds: number): void;
  /** Called if the crosshair leaves the item while it is pressed. */
  onCancel?(): void;
  /** Card shown while targeted (name, details). */
  info?(): InfoCardData | null;
  onFocus?(): void;
  onBlur?(): void;
}

export interface InfoCardData {
  /** Changes whenever the card content should re-render. */
  key: string;
  title: string;
  badge?: { text: string; color: string };
  sub?: string;
  tag?: string;
}

/** Highlight target that outlines nothing (for markers drawn another way). */
export const NO_OUTLINE = new THREE.Object3D();

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
  private pressed: Interactable | null = null;
  private pressedAt = 0;

  constructor() {
    this.raycaster.far = REACH;
  }

  add(item: Interactable): void {
    this.items.add(item);
  }

  remove(item: Interactable): void {
    this.items.delete(item);
    if (this.current === item) {
      item.onBlur?.();
      this.current = null;
    }
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
    const next = best ?? ambient;
    if (this.pressed && this.pressed !== next) {
      // Aim drifted off a held item: stop the hold.
      this.pressed.onCancel?.();
      this.pressed = null;
    }
    if (next !== this.current) {
      this.current?.onBlur?.();
      this.current = next;
      next?.onFocus?.();
    }
    return this.current;
  }

  /** The object to highlight (null for ambient actions). */
  get highlightTarget(): THREE.Object3D | null {
    return this.current?.highlight ?? this.current?.object ?? null;
  }

  /** Action button pressed. Returns true if something handled it. */
  press(): boolean {
    const item = this.current;
    if (!item || item.label() === null) return false;
    if (item.onPress) {
      this.pressed = item;
      this.pressedAt = performance.now();
      item.onPress();
    } else {
      item.act();
    }
    return true;
  }

  release(): void {
    const item = this.pressed;
    if (!item) return;
    this.pressed = null;
    item.onRelease?.((performance.now() - this.pressedAt) / 1000);
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
