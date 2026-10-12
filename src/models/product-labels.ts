import * as THREE from 'three';
import type { ProductDef } from '../config/products';
import { cachedTexture, canvasTexture, makeCanvas } from '../core/cache';

const FONT = `"Nunito", ui-rounded, "Arial Rounded MT Bold", "Segoe UI", system-ui, sans-serif`;
/** Pixels per metre for label canvases. */
const PX_PER_M = 1280;
/** Corner patch filled with the body colour; side faces sample from it. */
export const SOLID_PATCH = 24;

const snap = (v: number, step = 16): number => Math.max(step * 2, Math.round(v / step) * step);

export interface LabelSpec {
  width: number;
  height: number;
  /** true = label wraps a cylinder (drawn at both seam ends). */
  wrap: boolean;
}

export function labelSpec(def: ProductDef): LabelSpec {
  const [w, h] = def.size;
  switch (def.kind) {
    case 'can':
    case 'tube':
      return { width: snap(Math.PI * w * PX_PER_M, 32), height: snap(h * PX_PER_M), wrap: true };
    case 'bucket':
      return { width: snap(Math.PI * w * PX_PER_M * 1.05, 32), height: snap(h * PX_PER_M), wrap: true };
    default:
      return { width: snap(w * PX_PER_M), height: snap(h * PX_PER_M), wrap: false };
  }
}

/** UV that samples the solid colour patch of a label canvas. */
export function solidUv(spec: { width: number; height: number }): [number, number] {
  return [(SOLID_PATCH / 2) / spec.width, (SOLID_PATCH / 2) / spec.height];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Largest font size (<= max) at which `text` fits in `width`. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number, max: number, weight = 900): number {
  let size = max;
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (size > 8 && ctx.measureText(text).width > width) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  return size;
}

function catFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.95, cy - r * 0.2);
  ctx.lineTo(cx - r * 0.8, cy - r * 1.15);
  ctx.lineTo(cx - r * 0.2, cy - r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.95, cy - r * 0.2);
  ctx.lineTo(cx + r * 0.8, cy - r * 1.15);
  ctx.lineTo(cx + r * 0.2, cy - r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * r * 0.38, cy - r * 0.05, r * 0.16, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.3, r * 0.1, r * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** One label panel centred on `cx` (width `pw`) over the full canvas height. */
function drawPanel(ctx: CanvasRenderingContext2D, def: ProductDef, cx: number, pw: number, h: number): void {
  const px = cx - pw / 2;
  const m = h * 0.05;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, px, m, pw, h - m * 2, pw * 0.1);
  ctx.fill();

  // Coloured header with a cat face.
  const bandH = (h - m * 2) * 0.3;
  ctx.fillStyle = def.accent;
  ctx.save();
  roundRect(ctx, px, m, pw, h - m * 2, pw * 0.1);
  ctx.clip();
  ctx.fillRect(px, m, pw, bandH);
  ctx.restore();
  catFace(ctx, cx, m + bandH * 0.56, Math.min(bandH * 0.3, pw * 0.2), '#ffffff');
  // Eyes/nose on white face need the dark colour: overdraw in accent.
  ctx.fillStyle = def.accent;
  const r = Math.min(bandH * 0.3, pw * 0.2);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * r * 0.38, m + bandH * 0.56 - r * 0.05, r * 0.16, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Name (up to two lines), centred in the white area.
  const words = def.name.split(' ');
  const lines = words.length > 1 ? [words[0], words.slice(1).join(' ')] : [words[0]];
  const areaTop = m + bandH;
  const areaH = h - m * 2 - bandH;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxW = pw * 0.86;
  const size = Math.min(...lines.map((l) => fit(ctx, l, maxW, areaH * 0.3)));
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.fillStyle = def.accent;
  const total = lines.length * size * 1.05;
  lines.forEach((l, i) => ctx.fillText(l, cx, areaTop + areaH * 0.45 - total / 2 + size * (i + 0.55) * 1.05));

  // Sub text in a colour pill at the bottom.
  const pillH = areaH * 0.2;
  const pillW = pw * 0.7;
  const pillY = h - m * 2 - pillH * 1.15;
  ctx.fillStyle = def.color;
  roundRect(ctx, cx - pillW / 2, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  const ss = fit(ctx, def.sub.toUpperCase(), pillW * 0.88, pillH * 0.55, 800);
  ctx.font = `800 ${ss}px ${FONT}`;
  ctx.fillStyle = def.accent;
  ctx.fillText(def.sub.toUpperCase(), cx, pillY + pillH / 2 + 1);
}

/** Wrapped / flat label texture for packaged goods (bag, can, bucket...). */
export function productLabelTexture(def: ProductDef): THREE.CanvasTexture {
  return cachedTexture(`label:${def.id}`, () => {
    const spec = labelSpec(def);
    const [c, ctx] = makeCanvas(spec.width, spec.height);
    ctx.fillStyle = def.color;
    ctx.fillRect(0, 0, spec.width, spec.height);
    // Soft vertical sheen so flat colour doesn't look plastic.
    const g = ctx.createLinearGradient(0, 0, 0, spec.height);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, spec.width, spec.height);

    if (spec.wrap) {
      const pw = Math.min(spec.width * 0.42, spec.height * 1.15);
      drawPanel(ctx, def, 0, pw, spec.height);
      drawPanel(ctx, def, spec.width, pw, spec.height);
    } else {
      drawPanel(ctx, def, spec.width / 2, spec.width * 0.86, spec.height);
    }
    // Solid-colour patch (bottom-left) for sides and caps.
    ctx.fillStyle = def.color;
    ctx.fillRect(0, spec.height - SOLID_PATCH, SOLID_PATCH, SOLID_PATCH);
    return canvasTexture(c);
  });
}

export const CARTON_W = 256;
export const CARTON_H = 176;
const CARDBOARD = '#d9a96f';

/** Delivery carton front: cardboard, tape and a product sticker. */
export function cartonTexture(def: ProductDef): THREE.CanvasTexture {
  return cachedTexture(`carton:${def.id}`, () => {
    const [c, ctx] = makeCanvas(CARTON_W, CARTON_H);
    ctx.fillStyle = CARDBOARD;
    ctx.fillRect(0, 0, CARTON_W, CARTON_H);
    ctx.fillStyle = 'rgba(120, 80, 40, 0.12)';
    for (let i = 0; i < 6; i++) ctx.fillRect(0, 20 + i * 26, CARTON_W, 2);
    // flap seam + tape
    ctx.fillStyle = 'rgba(120, 80, 40, 0.3)';
    ctx.fillRect(0, 34, CARTON_W, 3);
    ctx.fillStyle = '#ecd7ae';
    ctx.fillRect(CARTON_W / 2 - 17, 0, 34, CARTON_H);
    // sticker
    const sw = 188;
    const sh = 104;
    const sx = (CARTON_W - sw) / 2;
    const sy = 52;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, sx, sy, sw, sh, 14);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.save();
    roundRect(ctx, sx, sy, sw, sh, 14);
    ctx.clip();
    ctx.fillRect(sx, sy, sw, 30);
    ctx.restore();
    catFace(ctx, sx + 24, sy + 15, 11, '#ffffff');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = def.accent;
    ctx.font = `800 13px ${FONT}`;
    ctx.fillText('L&B CATTERY', sx + 42, sy + 16);
    ctx.textAlign = 'center';
    const maxW = sw - 24;
    const words = def.name.split(' ');
    const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [def.name];
    const size = Math.min(...lines.map((l) => fit(ctx, l, maxW, 30)));
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.fillStyle = def.accent;
    lines.forEach((l, i) => ctx.fillText(l, CARTON_W / 2, sy + 52 + i * size));
    ctx.fillStyle = 'rgba(59, 58, 74, 0.7)';
    ctx.font = `800 13px ${FONT}`;
    ctx.fillText(`BOX OF ${def.boxSize}`, CARTON_W / 2, sy + sh - 14);
    ctx.fillStyle = CARDBOARD;
    ctx.fillRect(0, CARTON_H - SOLID_PATCH, SOLID_PATCH, SOLID_PATCH);
    return canvasTexture(c);
  });
}

/** Cardboard texture used for the sides of a carton. */
export const CARTON_SOLID_UV: [number, number] = [(SOLID_PATCH / 2) / CARTON_W, (SOLID_PATCH / 2) / CARTON_H];
