import * as THREE from 'three';
import { CARE, CASHIER_SECONDS, HIRE_WAGES, STAFF_BY_ROLE, WAGE_INTERVAL, type StaffRole } from '../config/care';
import type { NavGrid } from '../core/nav';
import { randomCharacterParams } from '../models/character-builder';
import { COUNTER, DOOR_INSIDE } from '../world/layout';
import { toast } from '../ui/toast';
import type { Customer } from './customer';
import type { CustomerSystem } from './customers';
import type { Mess, MessSystem } from './mess';
import { NavWalker } from './nav-walker';
import { gameStore, spendMoney } from './state';
import type { Villa, VillaManager } from './villas';

const V = new THREE.Vector3();
const ANCHOR = new THREE.Vector3();

type Job =
  | { kind: 'serve'; customer: Customer; t: number }
  | { kind: 'mess'; mess: Mess; phase: 'walk' | 'work' }
  | { kind: 'litter' | 'feed' | 'play'; villa: Villa; phase: 'walk' | 'work' };

/** Where each role waits when it has nothing to do. */
const HOME: Record<StaffRole, { x: number; z: number; face: number }> = {
  cashier: { x: COUNTER.x - COUNTER.w / 2 - 0.55, z: COUNTER.z, face: Math.PI / 2 },
  cleaner: { x: -2.6, z: 2.6, face: Math.PI },
  caretaker: { x: -1.4, z: 2.6, face: Math.PI },
};

class StaffMember extends NavWalker {
  job: Job | null = null;
  thinkTimer = 0.5;

  constructor(readonly role: StaffRole, nav: NavGrid) {
    super(
      V.set(DOOR_INSIDE.x, 0, DOOR_INSIDE.z),
      nav,
      { ...randomCharacterParams(), apron: STAFF_BY_ROLE[role].apron, shirt: STAFF_BY_ROLE[role].shirt },
      1.25,
    );
  }
}

/** Hired helpers: wages every minute, each role does one job automatically. */
export class StaffSystem {
  private readonly members: StaffMember[] = [];
  private wageTimer = WAGE_INTERVAL;
  /** Villas a helper is already handling, so two don't take the same job. */
  private readonly busyVillas = new Set<Villa>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly nav: NavGrid,
    private readonly customers: CustomerSystem,
    private readonly mess: MessSystem,
    private readonly villas: VillaManager | null,
  ) {}

  has(role: StaffRole): boolean {
    return this.members.some((m) => m.role === role);
  }

  roles(): StaffRole[] {
    return this.members.map((m) => m.role);
  }

  hireCost(role: StaffRole): number {
    return STAFF_BY_ROLE[role].wage * HIRE_WAGES;
  }

  hire(role: StaffRole, free = false): { ok: true } | { ok: false; reason: string } {
    const def = STAFF_BY_ROLE[role];
    if (this.has(role)) return { ok: false, reason: 'Already hired' };
    if (gameStore.getState().level < def.hireLevel) return { ok: false, reason: `Unlocks at level ${def.hireLevel}` };
    if (!free && !spendMoney(this.hireCost(role), 'invest')) return { ok: false, reason: 'Not enough money' };
    const m = new StaffMember(role, this.nav);
    this.members.push(m);
    this.scene.add(m.root, m.bubble.sprite);
    return { ok: true };
  }

  fire(role: StaffRole): void {
    const i = this.members.findIndex((m) => m.role === role);
    if (i < 0) return;
    this.release(this.members[i]);
    this.scene.remove(this.members[i].root, this.members[i].bubble.sprite);
    this.members.splice(i, 1);
  }

  /** Seconds until the next payday. */
  get nextPayIn(): number {
    return this.wageTimer;
  }

  update(dt: number): void {
    if (this.members.length > 0) {
      this.wageTimer -= dt;
      if (this.wageTimer <= 0) {
        this.wageTimer += WAGE_INTERVAL;
        this.payWages();
      }
    }
    for (const m of this.members) {
      m.update(dt, ANCHOR);
      this.think(m, dt);
    }
  }

  private payWages(): void {
    for (const m of [...this.members]) {
      const def = STAFF_BY_ROLE[m.role];
      if (!spendMoney(def.wage, 'wages')) {
        toast(`${def.name} quit: couldn't be paid`, 'bad');
        this.fire(m.role);
      }
    }
  }

  private release(m: StaffMember): void {
    const j = m.job;
    if (!j) return;
    if (j.kind === 'serve') j.customer.stage = 'waiting';
    else if (j.kind === 'mess') j.mess.claimed = false;
    else this.busyVillas.delete(j.villa);
    m.job = null;
    m.character.reach = 0;
  }

  // ----------------------------------------------------------------------- AI

  private think(m: StaffMember, dt: number): void {
    const j = m.job;
    if (j) {
      this.advance(m, j, dt);
      return;
    }
    m.thinkTimer -= dt;
    if (m.thinkTimer > 0) return;
    m.thinkTimer = 0.7;
    const job = this.pick(m);
    if (job) {
      m.job = job;
      this.start(m, job);
    } else if (m.idle) {
      const h = HOME[m.role];
      if (Math.hypot(m.position.x - h.x, m.position.z - h.z) > 0.3) m.goTo(h.x, h.z, h.face);
    }
  }

  private pick(m: StaffMember): Job | null {
    if (m.role === 'cashier') {
      const c = this.customers.head();
      if (!c || Math.hypot(m.position.x - HOME.cashier.x, m.position.z - HOME.cashier.z) > 0.6) return null;
      c.stage = 'paying';
      return { kind: 'serve', customer: c, t: CASHIER_SECONDS };
    }
    if (m.role === 'cleaner') {
      const mess = this.mess.nearest(m.position.x, m.position.z);
      if (mess) {
        mess.claimed = true;
        return { kind: 'mess', mess, phase: 'walk' };
      }
      const v = this.villas?.villas.find((x) => x.cat && x.dirt > 0.5 && !this.busyVillas.has(x));
      if (v) {
        this.busyVillas.add(v);
        return { kind: 'litter', villa: v, phase: 'walk' };
      }
      return null;
    }
    const hungry = this.villas?.villas.find((x) => x.cat && x.needs.food < 0.5 && !this.busyVillas.has(x) && this.villas?.hasFood());
    if (hungry) {
      this.busyVillas.add(hungry);
      return { kind: 'feed', villa: hungry, phase: 'walk' };
    }
    const bored = this.villas?.villas.find((x) => x.cat && x.needs.fun < 0.4 && !this.busyVillas.has(x));
    if (bored) {
      this.busyVillas.add(bored);
      return { kind: 'play', villa: bored, phase: 'walk' };
    }
    return null;
  }

  private start(m: StaffMember, j: Job): void {
    if (j.kind === 'serve') {
      m.character.reach = 1;
      return;
    }
    if (j.kind === 'mess') {
      m.goTo(j.mess.x, j.mess.z + 0.4, Math.PI);
      return;
    }
    j.villa.standPoint(V);
    m.goTo(V.x, V.z, Math.atan2(j.villa.spot.x - V.x, j.villa.spot.z - V.z));
  }

  private advance(m: StaffMember, j: Job, dt: number): void {
    if (j.kind === 'serve') {
      j.t -= dt;
      if (j.customer.stage !== 'paying') {
        this.release(m); // the player took over, or the customer left
        return;
      }
      if (j.t <= 0) {
        m.character.reach = 0;
        this.customers.completeCheckout(j.customer, 0);
        m.job = null;
      }
      return;
    }
    // Cleaning jobs: walk there, spend a moment working, then do it.
    if (j.kind === 'mess' && !this.mess.messes.includes(j.mess)) {
      this.release(m);
      return;
    }
    if ((j.kind === 'litter' || j.kind === 'feed' || j.kind === 'play') && (j.villa.removed || !j.villa.cat)) {
      this.release(m);
      return;
    }
    if (!m.idle) return;
    if (j.phase === 'walk') {
      j.phase = 'work';
      m.pause(CARE.choreSeconds);
      m.character.reach = 1;
      return;
    }
    m.character.reach = 0;
    if (j.kind === 'mess') {
      this.mess.clean(j.mess);
    } else if (j.kind === 'litter') {
      this.villas?.cleanLitter(j.villa);
    } else if (j.kind === 'feed') {
      this.villas?.feed(j.villa, true);
    } else {
      this.villas?.play(j.villa, 0.6);
    }
    this.release(m);
    m.job = null;
  }
}
