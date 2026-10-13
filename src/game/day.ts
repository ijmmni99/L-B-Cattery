import { DAY, rushFactor } from '../config/day';
import { addXp, dayStats, resetDayStats, type DayStats } from './state';

export type DayPhase = 'open' | 'closing' | 'report';

export interface DayReport extends DayStats {
  day: number;
  profit: number;
  stars: number;
  xp: number;
  cleanliness: number;
}

/** Shop days: open hours, closing time, then an end-of-day report. */
export class DayCycle {
  day = 1;
  phase: DayPhase = 'open';
  /** Seconds into the open period. */
  t = 0;
  private closingT = 0;
  private cleanSum = 0;
  private cleanSamples = 0;
  private sampleT = 0;
  private readonly reportListeners: Array<(r: DayReport) => void> = [];

  /** Current clock hour (9..18). */
  get hour(): number {
    const k = Math.min(1, this.t / DAY.openSeconds);
    return DAY.openHour + k * (DAY.closeHour - DAY.openHour);
  }

  get isOpen(): boolean {
    return this.phase === 'open';
  }

  get rush(): number {
    return rushFactor(this.hour);
  }

  onReport(fn: (r: DayReport) => void): void {
    this.reportListeners.push(fn);
  }

  /** Advance the clock. `inStore` = customers still in the shop; `cleanliness` is sampled for the report. */
  update(dt: number, inStore: number, cleanliness: number): void {
    if (this.phase === 'report') return;
    this.sampleT += dt;
    if (this.sampleT >= 1) {
      this.sampleT = 0;
      this.cleanSum += cleanliness;
      this.cleanSamples++;
    }
    if (this.phase === 'open') {
      this.t += dt;
      if (this.t >= DAY.openSeconds) {
        this.t = DAY.openSeconds;
        this.phase = 'closing';
        this.closingT = 0;
      }
      return;
    }
    this.closingT += dt;
    if (inStore === 0 || this.closingT >= DAY.closingGrace) this.finish();
  }

  private finish(): void {
    this.phase = 'report';
    const profit = Math.round((dayStats.revenue - dayStats.supplies - dayStats.wages) * 100) / 100;
    const cleanliness = this.cleanSamples ? this.cleanSum / this.cleanSamples : 1;
    let stars = 1;
    if (profit > 0) stars++;
    if (dayStats.walkouts === 0 && cleanliness >= 0.8 && dayStats.served >= 3) stars++;
    const report: DayReport = { ...dayStats, day: this.day, profit, stars, xp: stars * 12 + dayStats.served, cleanliness };
    for (const fn of this.reportListeners) fn(report);
  }

  /** From the report's button: pays the XP and opens the next morning. */
  startNextDay(xp: number): void {
    addXp(xp);
    this.day++;
    this.t = 0;
    this.phase = 'open';
    this.cleanSum = 0;
    this.cleanSamples = 0;
    resetDayStats();
  }

  serialize(): { n: number; t: number; closed: boolean } {
    return { n: this.day, t: this.t, closed: this.phase !== 'open' };
  }

  restore(s: { n: number; t: number; closed: boolean }): void {
    this.day = Math.max(1, Math.floor(s.n));
    this.t = Math.min(DAY.openSeconds, Math.max(0, s.t));
    if (s.closed) {
      this.t = DAY.openSeconds;
      this.phase = 'closing';
      this.closingT = 0;
    }
  }
}
