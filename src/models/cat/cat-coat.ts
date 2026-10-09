import * as THREE from 'three';
import type { CoatVariant } from '../../config/cats';
import { fbm3, smoothstep } from '../../core/noise';
import type { CatDims } from './cat-anatomy';
import type { ColorFn } from './skinned-builder';

export type CoatRegion = 'body' | 'ruff' | 'head' | 'cheek' | 'muzzle' | 'chin' | 'ear' | 'leg' | 'paw' | 'tail';

const WHITE = new THREE.Color('#fbf8f3');

/**
 * Builds per-region colour functions that paint the coat pattern from
 * seeded 3D noise in model space: seamless across parts, no textures.
 */
export class CoatPainter {
  private readonly base: THREE.Color;
  private readonly dark: THREE.Color;
  private readonly accent: THREE.Color;
  private readonly out = new THREE.Color();

  constructor(
    private readonly coat: CoatVariant,
    private readonly d: CatDims,
    private readonly seed: number,
  ) {
    this.base = new THREE.Color(coat.base);
    this.dark = new THREE.Color(coat.dark);
    this.accent = new THREE.Color(coat.accent ?? coat.dark);
  }

  fn(region: CoatRegion): ColorFn {
    return (p) => this.color(region, p);
  }

  /** Whether the coat is dark (affects nose / inner-ear tones). */
  get isDark(): boolean {
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(this.coat.base).getHSL(hsl);
    return hsl.l < 0.3;
  }

  private color(region: CoatRegion, p: THREE.Vector3): THREE.Color {
    const c = this.out;
    const { coat, d, seed } = this;
    const n = fbm3(p.x * 9, p.y * 9, p.z * 9, seed);

    switch (coat.pattern) {
      case 'solid':
        c.copy(this.base);
        break;
      case 'tabby':
        c.copy(this.base).lerp(this.dark, this.tabby(region, p) * 0.85);
        break;
      case 'pointed':
        c.copy(this.base).lerp(this.dark, this.points(region, p));
        break;
      case 'calico': {
        c.copy(this.base);
        const a = fbm3(p.x * 7, p.y * 7, p.z * 7, seed + 11);
        const b = fbm3(p.x * 7, p.y * 7, p.z * 7, seed + 57);
        const topBias = (p.y - d.bodyY) * 1.5;
        if (a + topBias > 0.53) c.copy(this.accent);
        else if (b + topBias > 0.56) c.copy(this.dark);
        break;
      }
      case 'tortie': {
        const m = fbm3(p.x * 16, p.y * 16, p.z * 16, seed + 5);
        c.copy(this.base).lerp(this.accent, smoothstep(0.45, 0.62, m));
        break;
      }
      case 'tuxedo':
        c.copy(this.base);
        break;
    }

    // White areas: muzzle, chest, belly, paws (amount from coat.white).
    const w = this.whiteness(region, p, n);
    if (w > 0) c.lerp(WHITE, w);

    // Subtle fur variation so solids don't look plastic.
    const v = 0.95 + n * 0.1;
    c.r *= v;
    c.g *= v;
    c.b *= v;
    return c;
  }

  private tabby(region: CoatRegion, p: THREE.Vector3): number {
    const { d, seed } = this;
    const warp = fbm3(p.x * 14, p.y * 14, p.z * 14, seed + 3) * 2.6;
    let s: number;
    switch (region) {
      case 'body':
      case 'ruff':
        s = Math.sin(p.z * 70 + warp + Math.abs(p.x) * 20);
        // Lighter belly.
        if (p.y < d.bodyY - d.bodyR * 0.35) s -= 0.8;
        break;
      case 'tail':
        s = Math.sin((p.y - p.z) * 55 + warp);
        break;
      case 'leg':
      case 'paw':
        s = Math.sin(p.y * 80 + warp) - 0.3;
        break;
      case 'head': {
        // Forehead "M" stripes on top, cheek swirls on the sides.
        const top = p.y > d.head[1] + d.headR * 0.25 ? 1 : 0;
        s = top ? Math.sin(p.x * 120 + warp) : Math.sin(p.y * 90 + warp) - 0.4;
        break;
      }
      case 'cheek':
        s = Math.sin(p.y * 110 + warp) - 0.5;
        break;
      default:
        s = -1;
    }
    return smoothstep(0.25, 0.75, s);
  }

  private points(region: CoatRegion, p: THREE.Vector3): number {
    const { d } = this;
    switch (region) {
      case 'ear':
        return 1;
      case 'tail': {
        const along = Math.hypot(p.y - d.tailBase[1], p.z - d.tailBase[2]);
        return 0.35 + smoothstep(0, 0.12, along) * 0.65;
      }
      case 'leg':
        return 0.25 + (1 - smoothstep(0.01, d.bodyY, p.y)) * 0.75;
      case 'paw':
        return 1;
      case 'muzzle':
      case 'chin':
        return 0.95;
      case 'head':
      case 'cheek': {
        // Face mask centred on the muzzle.
        const mx = p.x;
        const my = p.y - (d.head[1] - d.headR * 0.25);
        const mz = p.z - (d.head[2] + d.headR * 0.85);
        const dist = Math.hypot(mx * 0.9, my, mz);
        return 1 - smoothstep(d.headR * 0.35, d.headR * 0.95, dist);
      }
      case 'body':
        // Slightly darker back.
        return smoothstep(d.bodyY, d.bodyY + d.bodyR, p.y) * 0.18;
      default:
        return 0;
    }
  }

  private whiteness(region: CoatRegion, p: THREE.Vector3, n: number): number {
    const amt = this.coat.white;
    if (amt <= 0) return 0;
    const { d } = this;
    const edge = (n - 0.5) * 0.02;
    switch (region) {
      case 'muzzle':
      case 'chin':
        return 1;
      case 'cheek':
        return amt >= 0.6 ? 1 - smoothstep(-0.005, 0.02, p.y - d.head[1] + d.headR * 0.2 + edge) : 0;
      case 'paw':
        return amt >= 0.6 ? 1 : 0;
      case 'leg':
        return amt >= 0.6 ? 1 - smoothstep(0.03, 0.07 + amt * 0.04, p.y + edge) : 0;
      case 'body':
      case 'ruff': {
        // Chest bib + belly; tuxedo also gets a wider front.
        const belly = smoothstep(d.bodyY - d.bodyR * (amt >= 0.6 ? 0.1 : 0.55), d.bodyY - d.bodyR * 0.85, p.y + edge);
        const chestFront = p.z > d.chest[2] ? smoothstep(d.bodyY + d.bodyR * 0.2, d.bodyY - d.bodyR * 0.3, p.y + edge) : 0;
        return Math.max(belly * Math.min(1, amt * 1.5), chestFront);
      }
      case 'head':
        return amt >= 0.9 ? 1 - smoothstep(d.head[1] - d.headR * 0.55, d.head[1] - d.headR * 0.2, p.y + edge) : 0;
      default:
        return 0;
    }
  }
}
