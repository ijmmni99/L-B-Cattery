export type UpdateFn = (dt: number, elapsed: number) => void;

/** requestAnimationFrame loop with clamped delta; pauses while the tab is hidden. */
export class GameLoop {
  private readonly updates: UpdateFn[] = [];
  private rafId = 0;
  private last = 0;
  private elapsed = 0;
  private running = false;

  constructor(private readonly render: () => void) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else this.start();
    });
  }

  add(fn: UpdateFn): void {
    this.updates.push(fn);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    // Clamp so a long stall (GC, tab switch) doesn't teleport everything.
    const dt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;
    this.elapsed += dt;
    for (const fn of this.updates) fn(dt, this.elapsed);
    this.render();
    this.rafId = requestAnimationFrame(this.tick);
  };
}
