import { COOK, CUSTOMER, PAYOUT, RULES, SHIFT } from './constants.ts';
import type { GameState, Grade } from './types.ts';

export function createState(): GameState {
  return {
    phase: 'start',
    elapsed: 0,
    timeLeft: SHIFT.duration,
    cash: 0,
    served: 0,
    missed: 0,
    combo: 0,
    dogs: [],
    customers: [],
    nextDogId: 1,
    nextCustomerId: 1,
    spawnTimer: 1.0,
  };
}

/** Map seconds of grill time to a doneness grade (matches the original's 7s / 14s steps). */
export function gradeOf(cookSeconds: number): Grade {
  if (cookSeconds < COOK.perfectFrom) return 'good'; // underdone but servable
  if (cookSeconds < COOK.overdoneFrom) return 'perfect';
  return 'overdone';
}

/** Cash for a serve. Every serve pays something (like the original); combo adds a small bonus. */
export function payoutFor(grade: Grade, combo: number): number {
  const base = grade === 'perfect' ? PAYOUT.perfect : grade === 'good' ? PAYOUT.good : PAYOUT.overdone;
  const bonus = Math.min(combo, PAYOUT.comboMax) * PAYOUT.comboStep;
  return base + bonus;
}

/** Place a fresh dog on an empty grill slot. Returns true if placed. */
export function startCooking(state: GameState, slot: number): boolean {
  if (state.phase !== 'playing') return false;
  if (state.dogs.some((d) => d.slot === slot)) return false;
  state.dogs.push({ id: state.nextDogId++, slot, cook: 0 });
  return true;
}

/**
 * Tap a grill slot that holds a dog to serve the most impatient waiting customer.
 * Returns the grade + cash, or null if nothing happened (empty slot / no customer waiting).
 */
export function serveFromSlot(state: GameState, slot: number): { grade: Grade; cash: number } | null {
  if (state.phase !== 'playing') return null;
  const dogIdx = state.dogs.findIndex((d) => d.slot === slot);
  if (dogIdx === -1) return null;
  const dog = state.dogs[dogIdx];

  const waiting = state.customers.filter((c) => !c.served && !c.leaving);
  if (waiting.length === 0) return null; // no one to serve; leave the dog cooking

  // serve the customer with the least patience left
  waiting.sort((a, b) => a.patience - b.patience);
  const customer = waiting[0];
  const grade = gradeOf(dog.cook);
  const gained = payoutFor(grade, state.combo);

  state.cash += gained;
  state.served += 1;
  state.combo += 1;
  customer.served = true;
  state.dogs.splice(dogIdx, 1);
  return { grade, cash: gained };
}

function spawnCustomer(state: GameState): void {
  if (state.customers.filter((c) => !c.leaving).length >= CUSTOMER.max) return;
  const used = new Set(state.customers.filter((c) => !c.leaving).map((c) => c.slot));
  let slot = 0;
  while (used.has(slot) && slot < CUSTOMER.max) slot++;
  if (slot >= CUSTOMER.max) return;
  state.customers.push({
    id: state.nextCustomerId++,
    slot,
    patience: RULES.patience,
    patienceMax: RULES.patience,
    served: false,
    leaving: false,
  });
}

/**
 * Advance the simulation by dt seconds. Mutates and returns state.
 * Pure with respect to time only (no rendering, no DOM) so it is unit-testable.
 * Returns whether a customer walked off this step.
 */
export function step(state: GameState, dt: number): { missed: boolean } {
  if (state.phase !== 'playing') return { missed: false };
  state.elapsed += dt;
  state.timeLeft = Math.max(0, state.timeLeft - dt);

  // cook dogs (seconds of grill time)
  for (const dog of state.dogs) {
    dog.cook += dt;
  }

  // customers lose patience; walking off costs the combo and counts as missed income
  let missed = false;
  for (const c of state.customers) {
    if (c.served || c.leaving) continue;
    c.patience -= dt;
    if (c.patience <= 0) {
      c.leaving = true;
      c.patience = 0;
      state.combo = 0;
      state.missed += 1;
      missed = true;
    }
  }

  // clear served / departed customers
  state.customers = state.customers.filter((c) => !c.served && !(c.leaving && c.patience <= 0));

  // spawning — constant cadence (original timerCustomers fires every 8s)
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnCustomer(state);
    state.spawnTimer = RULES.spawnInterval;
  }

  // shift over when the clock runs out
  if (state.timeLeft <= 0) {
    state.phase = 'gameover';
  }

  return { missed };
}

export function startGame(state: GameState): void {
  const fresh = createState();
  Object.assign(state, fresh, { phase: 'playing' });
}
