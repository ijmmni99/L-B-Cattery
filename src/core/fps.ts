/** Lightweight FPS / draw-call readout, shown only with ?debug=1. */
export class FpsCounter {
  private readonly el: HTMLDivElement;
  private frames = 0;
  private acc = 0;

  constructor(parent: HTMLElement, private readonly getDrawCalls: () => number) {
    this.el = document.createElement('div');
    this.el.className = 'fps-counter';
    parent.appendChild(this.el);
  }

  static enabled(): boolean {
    return new URLSearchParams(location.search).get('debug') === '1';
  }

  update(dt: number): void {
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.5) {
      const fps = Math.round(this.frames / this.acc);
      this.el.textContent = `${fps} FPS · ${this.getDrawCalls()} calls`;
      this.el.dataset.state = fps >= 50 ? 'good' : fps >= 30 ? 'ok' : 'bad';
      this.frames = 0;
      this.acc = 0;
    }
  }
}
