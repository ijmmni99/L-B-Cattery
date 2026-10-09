import * as THREE from 'three';
import { cachedTexture, canvasTexture, makeCanvas } from '../core/cache';

const FONT = `"Nunito", ui-rounded, "Arial Rounded MT Bold", "Segoe UI", system-ui, sans-serif`;

/** Deterministic PRNG so textures look the same every load. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Warm wooden planks; one tile covers 4 m x 4 m (8 planks of 0.5 m). */
export function woodFloorTexture(): THREE.CanvasTexture {
  return cachedTexture('wood-floor', () => {
    const size = 1024;
    const [c, ctx] = makeCanvas(size, size);
    const rand = rng(7);
    const rows = 8;
    const rowH = size / rows;
    const tones = ['#e4b583', '#e0ae7b', '#e8bc8c', '#dcaa77', '#e2b27f'];
    for (let r = 0; r < rows; r++) {
      let x = -rand() * 300;
      while (x < size) {
        const len = 420 + rand() * 380;
        ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
        ctx.fillRect(x, r * rowH, len, rowH);
        // soft grain
        ctx.strokeStyle = 'rgba(150, 95, 50, 0.10)';
        ctx.lineWidth = 2;
        for (let g = 0; g < 5; g++) {
          const gy = r * rowH + 10 + rand() * (rowH - 20);
          ctx.beginPath();
          ctx.moveTo(x + 8, gy);
          ctx.bezierCurveTo(x + len * 0.3, gy + 6 * (rand() - 0.5), x + len * 0.7, gy + 6 * (rand() - 0.5), x + len - 8, gy);
          ctx.stroke();
        }
        // plank end seam
        ctx.fillStyle = 'rgba(120, 75, 40, 0.28)';
        ctx.fillRect(x + len - 2, r * rowH, 2, rowH);
        x += len;
      }
      // row seam + highlight
      ctx.fillStyle = 'rgba(120, 75, 40, 0.3)';
      ctx.fillRect(0, r * rowH, size, 2);
      ctx.fillStyle = 'rgba(255, 240, 220, 0.25)';
      ctx.fillRect(0, r * rowH + 3, size, 2);
    }
    const tex = canvasTexture(c, true);
    return tex;
  });
}

/** Pastel city skyline seen through the shop window. */
export function cityBackdropTexture(): THREE.CanvasTexture {
  return cachedTexture('city-backdrop', () => {
    const w = 2048;
    const h = 1024;
    const [c, ctx] = makeCanvas(w, h);
    const rand = rng(42);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#9fd3f0');
    sky.addColorStop(0.55, '#d7ecf5');
    sky.addColorStop(1, '#ffe6cf');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // fluffy clouds
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 7; i++) {
      const cx = rand() * w;
      const cy = 80 + rand() * 260;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.ellipse(cx + k * 38 - 80, cy + Math.sin(k) * 10, 60 + rand() * 30, 34 + rand() * 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const layers = [
      { base: 0.72, color: '#c9c2e6', win: 'rgba(255,255,255,0.35)', minH: 180, maxH: 430 },
      { base: 0.82, color: '#a9d8cf', win: 'rgba(255,255,240,0.55)', minH: 150, maxH: 360 },
      { base: 0.92, color: '#f4b9b2', win: 'rgba(255,250,230,0.7)', minH: 120, maxH: 280 },
    ];
    for (const layer of layers) {
      let x = -40;
      while (x < w) {
        const bw = 110 + rand() * 150;
        const bh = layer.minH + rand() * (layer.maxH - layer.minH);
        const top = h * layer.base - bh;
        ctx.fillStyle = layer.color;
        roundRect(ctx, x, top, bw, bh + 200, 18);
        ctx.fill();
        ctx.fillStyle = layer.win;
        for (let wy = top + 24; wy < h * layer.base - 30; wy += 42) {
          for (let wx = x + 18; wx < x + bw - 30; wx += 34) {
            if (rand() > 0.25) {
              roundRect(ctx, wx, wy, 18, 24, 5);
              ctx.fill();
            }
          }
        }
        x += bw + 8 + rand() * 30;
      }
    }
    // street-level trees
    for (let i = 0; i < 14; i++) {
      const tx = (i + rand() * 0.6) * (w / 14);
      const ty = h * 0.94;
      ctx.fillStyle = '#9b7a5f';
      ctx.fillRect(tx - 6, ty - 40, 12, 60);
      ctx.fillStyle = i % 2 ? '#7fcf9c' : '#92d9a8';
      ctx.beginPath();
      ctx.arc(tx, ty - 70, 44 + rand() * 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e9e2d8';
    ctx.fillRect(0, h * 0.95, w, h * 0.05);
    return canvasTexture(c);
  });
}

/** Store logo: cat head + "L&B Cattery" on a transparent background. */
export function logoTexture(): THREE.CanvasTexture {
  return cachedTexture('logo', () => {
    const w = 1024;
    const h = 256;
    const [c, ctx] = makeCanvas(w, h);
    // cat head badge
    const cx = 128;
    const cy = 134;
    ctx.fillStyle = '#fff7ec';
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy - 10);
    ctx.lineTo(cx - 62, cy - 92);
    ctx.lineTo(cx - 18, cy - 58);
    ctx.lineTo(cx + 18, cy - 58);
    ctx.lineTo(cx + 62, cy - 92);
    ctx.lineTo(cx + 70, cy - 10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 10, 82, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff9fb5';
    ctx.beginPath();
    ctx.moveTo(cx - 54, cy - 40);
    ctx.lineTo(cx - 50, cy - 74);
    ctx.lineTo(cx - 28, cy - 54);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 54, cy - 40);
    ctx.lineTo(cx + 50, cy - 74);
    ctx.lineTo(cx + 28, cy - 54);
    ctx.fill();
    ctx.fillStyle = '#3b3a4a';
    for (const ex of [-30, 30]) {
      ctx.beginPath();
      ctx.ellipse(cx + ex, cy + 4, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    for (const ex of [-26, 34]) {
      ctx.beginPath();
      ctx.arc(cx + ex, cy - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ff8fab';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 30, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `900 132px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#4fa58c';
    ctx.strokeText('L&B Cattery', 240, 140);
    ctx.fillStyle = '#fff7ec';
    ctx.fillText('L&B Cattery', 240, 140);
    return canvasTexture(c);
  });
}

/** Neon "OPEN" sign face (glow is added by bloom on High). */
export function openSignTexture(): THREE.CanvasTexture {
  return cachedTexture('open-sign', () => {
    const w = 512;
    const h = 224;
    const [c, ctx] = makeCanvas(w, h);
    ctx.fillStyle = '#2f2b3d';
    roundRect(ctx, 8, 8, w - 16, h - 16, 48);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#7fe3d0';
    roundRect(ctx, 26, 26, w - 52, h - 52, 34);
    ctx.stroke();
    ctx.font = `900 120px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff6f98';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ffd1df';
    ctx.fillText('OPEN', w / 2, h / 2 + 6);
    return canvasTexture(c);
  });
}

/** Radial soft shadow used under characters, cats and furniture. */
export function blobShadowTexture(): THREE.CanvasTexture {
  return cachedTexture('blob-shadow', () => {
    const s = 128;
    const [c, ctx] = makeCanvas(s, s);
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(60, 40, 30, 0.55)');
    g.addColorStop(0.5, 'rgba(60, 40, 30, 0.25)');
    g.addColorStop(1, 'rgba(60, 40, 30, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return canvasTexture(c);
  });
}

/** Simple framed cat silhouette poster for wall decor. */
export function catPosterTexture(variant: number): THREE.CanvasTexture {
  return cachedTexture(`cat-poster-${variant}`, () => {
    const w = 256;
    const h = 320;
    const [c, ctx] = makeCanvas(w, h);
    const bgs = ['#ffd9c2', '#cfe8f7', '#e3d7f5'];
    const cats = ['#f08a4b', '#3b3a4a', '#c9a27e'];
    ctx.fillStyle = bgs[variant % bgs.length];
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = cats[variant % cats.length];
    // sitting cat silhouette
    ctx.beginPath();
    ctx.ellipse(128, 230, 62, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(128, 140, 46, 0, Math.PI * 2);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(128 + s * 40, 124);
      ctx.lineTo(128 + s * 36, 82);
      ctx.lineTo(128 + s * 12, 104);
      ctx.fill();
    }
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    ctx.moveTo(180, 280);
    ctx.quadraticCurveTo(236, 260, 214, 196);
    ctx.stroke();
    return canvasTexture(c);
  });
}
