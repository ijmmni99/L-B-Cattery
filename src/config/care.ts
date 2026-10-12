/** Care, mess and staff tuning. Rates are per second. */
export const CARE = {
  foodDecay: 1 / 200,
  funDecay: 1 / 260,
  dirtGrow: 1 / 220,
  /** Below this a cat wants feeding (the cat's action turns into "Feed"). */
  feedBelow: 0.65,
  hungryBelow: 0.3,
  funBelow: 0.3,
  /** The litter tray shows 1, 2, 3 messes at these dirt levels. */
  litterSteps: [0.3, 0.55, 0.8],
  playGain: 0.5,
  /** Adoption fee = value x (min + range x mood), mood = average of food, fun and cleanliness. */
  feeMin: 0.7,
  feeRange: 0.6,
  /** Seconds a person spends on one chore. */
  choreSeconds: 2.2,
} as const;

export const MESS = {
  max: 8,
  /** Seconds between a customer's chances to drop litter. */
  dropMin: 25,
  dropMax: 55,
  /** Cleanliness lost per mess / per full dirty villa. */
  perMess: 0.1,
  perVillaDirt: 0.25,
} as const;

export type StaffRole = 'cashier' | 'cleaner' | 'caretaker';

export interface StaffDef {
  role: StaffRole;
  name: string;
  icon: string;
  desc: string;
  /** Paid every WAGE_INTERVAL seconds. */
  wage: number;
  hireLevel: number;
  apron: string;
  shirt: string;
}

export const WAGE_INTERVAL = 60;
/** Hiring costs this many wages up front. */
export const HIRE_WAGES = 4;
/** Seconds a cashier takes to ring up a customer. */
export const CASHIER_SECONDS = 4;

export const STAFF: StaffDef[] = [
  { role: 'cashier', name: 'Cashier', icon: '🧾', desc: 'Rings up customers at the register for you (no tips).', wage: 8, hireLevel: 2, apron: '#ffd27a', shirt: '#8ec9ff' },
  { role: 'cleaner', name: 'Cleaner', icon: '🧹', desc: 'Cleans up messes and litter trays.', wage: 6, hireLevel: 3, apron: '#9fe0b8', shirt: '#f2f2f2' },
  { role: 'caretaker', name: 'Cat caretaker', icon: '🐾', desc: 'Feeds (from shelf stock) and plays with the cats.', wage: 8, hireLevel: 4, apron: '#ff9fb5', shirt: '#b8a6ff' },
];
export const STAFF_BY_ROLE: Record<StaffRole, StaffDef> = Object.fromEntries(STAFF.map((s) => [s.role, s])) as Record<StaffRole, StaffDef>;
