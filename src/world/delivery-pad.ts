import * as THREE from 'three';
import { cachedGeometry, cachedMaterial, cachedTexture, canvasTexture, makeCanvas } from '../core/cache';
import { DELIVERY_PAD } from './shelf-layout';

function padTexture(): THREE.CanvasTexture {
  return cachedTexture('delivery-pad', () => {
    const w = 512;
    const h = Math.round((512 * DELIVERY_PAD.d) / DELIVERY_PAD.w);
    const [c, ctx] = makeCanvas(w, h);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 28);
    ctx.fill();
    // hazard-style dashed border
    ctx.lineWidth = 14;
    ctx.setLineDash([34, 22]);
    ctx.strokeStyle = '#f2a93b';
    ctx.beginPath();
    ctx.roundRect(22, 22, w - 44, h - 44, 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(122, 75, 30, 0.55)';
    ctx.font = `900 40px "Nunito", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DELIVERY', w / 2, h - 44);
    return canvasTexture(c);
  });
}

/** Floor decal marking where supply boxes arrive. */
export function buildDeliveryPad(): THREE.Mesh {
  const geo = cachedGeometry('delivery-pad', () => new THREE.PlaneGeometry(DELIVERY_PAD.w + 0.2, DELIVERY_PAD.d + 0.2).rotateX(-Math.PI / 2));
  const mat = cachedMaterial('delivery-pad', () => new THREE.MeshStandardMaterial({ map: padTexture(), roughness: 0.9, transparent: true, depthWrite: false }));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(DELIVERY_PAD.x, 0.006, DELIVERY_PAD.z);
  m.receiveShadow = true;
  m.renderOrder = 1;
  return m;
}
