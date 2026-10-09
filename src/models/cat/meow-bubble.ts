import * as THREE from 'three';
import { MEOW_LINES } from '../../config/cats';
import { cachedTexture, canvasTexture, makeCanvas } from '../../core/cache';

function bubbleTexture(text: string): THREE.CanvasTexture {
  return cachedTexture(`meow:${text}`, () => {
    const w = 256;
    const h = 128;
    const [c, ctx] = makeCanvas(w, h);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(59, 58, 74, 0.18)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 36, 40);
    ctx.fill();
    ctx.stroke();
    // little tail
    ctx.beginPath();
    ctx.moveTo(w / 2 - 16, h - 30);
    ctx.lineTo(w / 2, h - 6);
    ctx.lineTo(w / 2 + 16, h - 30);
    ctx.fill();
    ctx.font = '900 46px "Nunito", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3b3a4a';
    ctx.fillText(text, w / 2, (h - 28) / 2 + 6);
    return canvasTexture(c);
  });
}

/** Pop-up "Meow!" speech bubble that floats above a cat's head. */
export class MeowBubble {
  readonly sprite: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private t = -1;

  constructor() {
    this.material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.visible = false;
    this.sprite.renderOrder = 4;
  }

  show(text = MEOW_LINES[Math.floor(Math.random() * MEOW_LINES.length)]): void {
    this.material.map = bubbleTexture(text);
    this.material.needsUpdate = true;
    this.t = 0;
    this.sprite.visible = true;
  }

  /** `anchor` = world point above the head. */
  update(dt: number, anchor: THREE.Vector3): void {
    if (this.t < 0) return;
    this.t += dt;
    const pop = Math.min(this.t / 0.18, 1);
    const fade = this.t > 1.3 ? Math.max(0, 1 - (this.t - 1.3) / 0.3) : 1;
    const s = 0.42 * (0.6 + 0.4 * pop + Math.sin(pop * Math.PI) * 0.15);
    this.sprite.scale.set(s, s * 0.5, 1);
    this.sprite.position.copy(anchor).y += this.t * 0.04;
    this.material.opacity = fade;
    if (this.t > 1.6) {
      this.t = -1;
      this.sprite.visible = false;
    }
  }
}
