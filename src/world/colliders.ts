import * as THREE from 'three';

export interface Box2 {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/**
 * Flat (XZ) collision world: axis-aligned boxes vs circles. Plenty for a
 * single-room shop and cheap enough for a dozen walkers.
 */
export class CollisionWorld {
  private readonly boxes = new Map<number, Box2>();
  private nextId = 1;

  add(box: Box2): number {
    const id = this.nextId++;
    this.boxes.set(id, box);
    return id;
  }

  /** Box centred on (x, z) with full size (w, d). */
  addCentered(x: number, z: number, w: number, d: number): number {
    return this.add({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  remove(id: number): void {
    this.boxes.delete(id);
  }

  /** Pushes a circle out of every overlapping box (in place). */
  resolveCircle(pos: THREE.Vector3, radius: number): void {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of this.boxes.values()) {
        const cx = THREE.MathUtils.clamp(pos.x, b.minX, b.maxX);
        const cz = THREE.MathUtils.clamp(pos.z, b.minZ, b.maxZ);
        let dx = pos.x - cx;
        let dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // Centre is inside the box: exit through the nearest side.
          const pushes = [b.minX - radius - pos.x, b.maxX + radius - pos.x, b.minZ - radius - pos.z, b.maxZ + radius - pos.z];
          let best = 0;
          for (let i = 1; i < 4; i++) if (Math.abs(pushes[i]) < Math.abs(pushes[best])) best = i;
          dx = best < 2 ? pushes[best] : 0;
          dz = best >= 2 ? pushes[best] : 0;
          pos.x += dx;
          pos.z += dz;
        }
        moved = true;
      }
      if (!moved) break;
    }
  }
}
