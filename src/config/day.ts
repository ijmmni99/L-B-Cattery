/** Day cycle tuning. A day is `openSeconds` of real time stretched over the opening hours. */
export const DAY = {
  openHour: 9,
  closeHour: 18,
  openSeconds: 240,
  /** After closing, customers get this long to finish before the day ends anyway. */
  closingGrace: 45,
} as const;

/** Customer arrival multiplier through the day: lunch and evening rushes. */
export function rushFactor(hour: number): number {
  if (hour < 11) return 0.8;
  if (hour < 14) return 1.5;
  if (hour < 16) return 0.9;
  return 1.3;
}

export function formatClock(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60 / 10) * 10;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}
