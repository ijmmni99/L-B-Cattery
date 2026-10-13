import { sfx } from '../core/sfx';
import type { DayCycle, DayReport } from '../game/day';

const money = (n: number): string => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

/** End-of-day card with the day's numbers and a button to open the next morning. */
export function createDayReport(parent: HTMLElement, day: DayCycle): void {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay day-overlay';
  overlay.innerHTML = `<div class="day-card" role="dialog" aria-label="Day report"></div>`;
  parent.appendChild(overlay);
  const card = overlay.querySelector<HTMLElement>('.day-card') as HTMLElement;

  day.onReport((r: DayReport) => {
    if (document.pointerLockElement) document.exitPointerLock();
    const row = (label: string, value: string, cls = ''): string => `<div class="day-row ${cls}"><span>${label}</span><b>${value}</b></div>`;
    card.innerHTML = `
      <h2>Day ${r.day} complete</h2>
      <div class="day-stars">${'⭐'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</div>
      ${row('Sales', money(r.revenue))}
      ${row('Supplies', `−${money(r.supplies)}`)}
      ${row('Wages', `−${money(r.wages)}`)}
      ${row('Profit', money(r.profit), r.profit >= 0 ? 'good' : 'bad')}
      ${r.invest > 0 ? row('Invested (builds, cats, hiring)', money(r.invest)) : ''}
      <div class="day-sep"></div>
      ${row('Customers served', String(r.served))}
      ${row('Cats adopted', String(r.adopted))}
      ${row('Left without buying', String(r.walkouts))}
      ${row('Missed sales (sold out)', String(r.missed))}
      ${row('Shop cleanliness', `${Math.round(r.cleanliness * 100)}%`)}
      <button type="button" class="big-btn day-next">Start day ${r.day + 1} · +${r.xp} XP</button>`;
    card.querySelector('.day-next')?.addEventListener('click', () => {
      sfx.done();
      overlay.classList.remove('open');
      day.startNextDay(r.xp);
    });
    sfx.levelUp();
    overlay.classList.add('open');
  });
}
