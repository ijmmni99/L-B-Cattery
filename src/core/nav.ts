import type { CollisionWorld } from '../world/colliders';

export interface Pt {
  x: number;
  z: number;
}

const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/**
 * Walkable-grid A* over the collision world, then line-of-sight smoothing.
 * Colliders are queried live, so placed boxes are avoided too.
 */
export class NavGrid {
  private readonly nx: number;
  private readonly nz: number;
  private readonly state: Uint8Array; // 0 unknown, 1 free, 2 blocked (per query)

  constructor(
    private readonly world: CollisionWorld,
    private readonly minX: number,
    private readonly minZ: number,
    maxX: number,
    maxZ: number,
    private readonly cell = 0.25,
    private readonly radius = 0.3,
  ) {
    this.nx = Math.ceil((maxX - minX) / cell);
    this.nz = Math.ceil((maxZ - minZ) / cell);
    this.state = new Uint8Array(this.nx * this.nz);
  }

  private cx(x: number): number {
    return Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.minX) / this.cell)));
  }
  private cz(z: number): number {
    return Math.min(this.nz - 1, Math.max(0, Math.floor((z - this.minZ) / this.cell)));
  }
  private wx(i: number): number {
    return this.minX + (i + 0.5) * this.cell;
  }
  private wz(j: number): number {
    return this.minZ + (j + 0.5) * this.cell;
  }

  private blocked(i: number, j: number): boolean {
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return true;
    const k = j * this.nx + i;
    if (this.state[k] === 0) this.state[k] = this.world.overlapsBox(this.wx(i), this.wz(j), this.radius, this.radius) ? 2 : 1;
    return this.state[k] === 2;
  }

  private clear(a: Pt, b: Pt): boolean {
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(dist / 0.12));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (this.world.overlapsBox(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, this.radius * 0.9, this.radius * 0.9)) return false;
    }
    return true;
  }

  private nearestFree(i: number, j: number): [number, number] | null {
    if (!this.blocked(i, j)) return [i, j];
    for (let r = 1; r <= 8; r++) {
      for (let di = -r; di <= r; di++) {
        for (let dj = -r; dj <= r; dj++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (!this.blocked(i + di, j + dj)) return [i + di, j + dj];
        }
      }
    }
    return null;
  }

  /** Waypoints from `from` to `to` (excluding `from`); straight line if the grid fails. */
  findPath(from: Pt, to: Pt): Pt[] {
    this.state.fill(0);
    if (this.clear(from, to)) return [to];
    const s = this.nearestFree(this.cx(from.x), this.cz(from.z));
    const g = this.nearestFree(this.cx(to.x), this.cz(to.z));
    if (!s || !g) return [to];
    const { nx } = this;
    const total = nx * this.nz;
    const gScore = new Float32Array(total).fill(Infinity);
    const parent = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const goal = g[1] * nx + g[0];
    const h = (i: number, j: number): number => Math.hypot(i - g[0], j - g[1]);

    // Tiny binary heap of [f, index].
    const heap: Array<[number, number]> = [];
    const push = (f: number, k: number): void => {
      heap.push([f, k]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]];
        c = p;
      }
    };
    const pop = (): [number, number] => {
      const top = heap[0];
      const last = heap.pop() as [number, number];
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = c * 2 + 1;
          const r = l + 1;
          let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]];
          c = m;
        }
      }
      return top;
    };

    const start = s[1] * nx + s[0];
    gScore[start] = 0;
    push(h(s[0], s[1]), start);
    let found = false;
    while (heap.length) {
      const [, k] = pop();
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === goal) {
        found = true;
        break;
      }
      const ci = k % nx;
      const cj = (k - ci) / nx;
      for (const [di, dj, cost] of DIRS) {
        const ni = ci + di;
        const nj = cj + dj;
        if (this.blocked(ni, nj)) continue;
        if (di !== 0 && dj !== 0 && (this.blocked(ci + di, cj) || this.blocked(ci, cj + dj))) continue; // no corner cutting
        const nk = nj * nx + ni;
        const ng = gScore[k] + cost;
        if (ng < gScore[nk]) {
          gScore[nk] = ng;
          parent[nk] = k;
          push(ng + h(ni, nj), nk);
        }
      }
    }
    if (!found) return [to];

    const cells: Pt[] = [];
    for (let k = goal; k !== -1; k = parent[k]) {
      const i = k % nx;
      cells.push({ x: this.wx(i), z: this.wz((k - i) / nx) });
    }
    cells.reverse();
    cells[cells.length - 1] = to;

    // String-pull: skip ahead to the farthest waypoint still in line of sight.
    const out: Pt[] = [];
    let anchor: Pt = from;
    let idx = 0;
    while (idx < cells.length) {
      let far = idx;
      for (let k = cells.length - 1; k > idx; k--) {
        if (this.clear(anchor, cells[k])) {
          far = k;
          break;
        }
      }
      out.push(cells[far]);
      anchor = cells[far];
      idx = far + 1;
    }
    return out;
  }
}
