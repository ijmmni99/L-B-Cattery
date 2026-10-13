import { createStore } from 'zustand/vanilla';
import { levelForXp, levelUpBonus, LEVEL_XP, MAX_LEVEL, PRICE_MAX_FACTOR, PRICE_MIN_FACTOR } from '../config/progression';
import { DEFAULT_PRICE, PRODUCT_BY_ID } from '../config/products';
import { toast } from '../ui/toast';

export interface GameState {
  money: number;
  xp: number;
  level: number;
}

export const START_MONEY = 500;
/** Seconds between ordering and the boxes appearing on the delivery pad. */
export const DELIVERY_SECONDS = 10;

/** Single source of truth for shop numbers. Systems read/write via actions. */
export const gameStore = createStore<GameState>(() => ({
  money: START_MONEY,
  xp: 0,
  level: 1,
}));

export function addMoney(amount: number): void {
  gameStore.setState((s) => ({ money: Math.round((s.money + amount) * 100) / 100 }));
}

/** What today's money was spent on (investments are builds, cats and hiring). */
export type ExpenseKind = 'supplies' | 'wages' | 'invest';

export interface DayStats {
  revenue: number;
  supplies: number;
  wages: number;
  invest: number;
  served: number;
  walkouts: number;
  adopted: number;
}

const freshStats = (): DayStats => ({ revenue: 0, supplies: 0, wages: 0, invest: 0, served: 0, walkouts: 0, adopted: 0 });
export const dayStats: DayStats = freshStats();

export function resetDayStats(): void {
  Object.assign(dayStats, freshStats());
}

/** Returns false (and changes nothing) if the shop can't afford it. */
export function spendMoney(amount: number, kind?: ExpenseKind): boolean {
  if (gameStore.getState().money < amount) return false;
  addMoney(-amount);
  if (kind) dayStats[kind] += amount;
  return true;
}

/** XP progress inside the current level, 0..1 (1 at max level). */
export function levelProgress(s: GameState = gameStore.getState()): number {
  if (s.level >= MAX_LEVEL) return 1;
  const lo = LEVEL_XP[s.level - 1];
  const hi = LEVEL_XP[s.level];
  return Math.min(1, (s.xp - lo) / (hi - lo));
}

/** Adds XP; level-ups pay a bonus and fire `onLevelUp`. */
export function addXp(amount: number): void {
  const before = gameStore.getState().level;
  const xp = gameStore.getState().xp + amount;
  const level = levelForXp(xp);
  gameStore.setState({ xp, level });
  for (let l = before + 1; l <= level; l++) {
    addMoney(levelUpBonus(l));
    toast(`Level ${l}! Bonus $${levelUpBonus(l)}`, 'good');
    for (const fn of levelUpListeners) fn(l);
  }
}

const levelUpListeners: Array<(level: number) => void> = [];
export function onLevelUp(fn: (level: number) => void): void {
  levelUpListeners.push(fn);
}

const priceListeners: Array<() => void> = [];
export function onPriceChange(fn: () => void): void {
  priceListeners.push(fn);
}

/** Sets a product's shelf price (clamped to a sane range around the suggested price). */
export function setProductPrice(id: string, price: number): void {
  const def = PRODUCT_BY_ID[id];
  if (!def) return;
  const base = DEFAULT_PRICE[id];
  const lo = Math.max(1, Math.round(base * PRICE_MIN_FACTOR));
  const hi = Math.round(base * PRICE_MAX_FACTOR);
  const next = Math.min(hi, Math.max(lo, Math.round(price)));
  if (next === def.price) return;
  def.price = next;
  for (const fn of priceListeners) fn();
}
