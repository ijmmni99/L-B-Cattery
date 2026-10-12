import { createStore } from 'zustand/vanilla';

export interface GameState {
  money: number;
}

export const START_MONEY = 500;
/** Seconds between ordering and the boxes appearing on the delivery pad. */
export const DELIVERY_SECONDS = 10;

/** Single source of truth for shop numbers. Systems read/write via actions. */
export const gameStore = createStore<GameState>(() => ({
  money: START_MONEY,
}));

export function addMoney(amount: number): void {
  gameStore.setState((s) => ({ money: Math.round((s.money + amount) * 100) / 100 }));
}

/** Returns false (and changes nothing) if the shop can't afford it. */
export function spendMoney(amount: number): boolean {
  if (gameStore.getState().money < amount) return false;
  addMoney(-amount);
  return true;
}
