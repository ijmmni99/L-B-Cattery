import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Shared geometry / material / texture caches. Everything static in the
 * world goes through here so identical parts reuse one GPU resource.
 */
const geometries = new Map<string, THREE.BufferGeometry>();
const materials = new Map<string, THREE.Material>();
const textures = new Map<string, THREE.Texture>();

export function cachedGeometry<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g as T;
}

export function cachedMaterial<T extends THREE.Material>(key: string, make: () => T): T {
  let m = materials.get(key);
  if (!m) {
    m = make();
    materials.set(key, m);
  }
  return m as T;
}

export function cachedTexture<T extends THREE.Texture>(key: string, make: () => T): T {
  let t = textures.get(key);
  if (!t) {
    t = make();
    textures.set(key, t);
  }
  return t as T;
}

/** Rounded box with radius clamped to the smallest half-extent. */
export function roundedBox(w: number, h: number, d: number, radius = 0.06, segments = 3): RoundedBoxGeometry {
  const r = Math.min(radius, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const key = `rbox:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${r.toFixed(3)}:${segments}`;
  return cachedGeometry(key, () => new RoundedBoxGeometry(w, h, d, segments, r));
}

/** Matte pastel standard material, cached by color + roughness. */
export function pastel(color: THREE.ColorRepresentation, roughness = 0.75, metalness = 0): THREE.MeshStandardMaterial {
  const hex = new THREE.Color(color).getHexString();
  return cachedMaterial(`pastel:${hex}:${roughness}:${metalness}`, () =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness }),
  );
}

/** Material whose base color is multiplied by per-vertex colors (gradients). */
export function vertexTinted(key: string, roughness = 0.8): THREE.MeshStandardMaterial {
  return cachedMaterial(`vtint:${key}:${roughness}`, () =>
    new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness }),
  );
}

/** Bakes a vertical colour gradient into a geometry's vertex colours. */
export function applyVerticalGradient(
  geometry: THREE.BufferGeometry,
  bottom: THREE.ColorRepresentation,
  top: THREE.ColorRepresentation,
): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return geometry;
  const pos = geometry.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Color(bottom);
  const b = new THREE.Color(top);
  const c = new THREE.Color();
  const span = Math.max(box.max.y - box.min.y, 1e-6);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - box.min.y) / span;
    c.copy(a).lerp(b, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [canvas, ctx];
}

export function canvasTexture(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Shadow-casting mesh helper so call sites stay one-liners. */
export function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  opts: { cast?: boolean; receive?: boolean } = {},
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.receive ?? true;
  return m;
}
