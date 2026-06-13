import { COOK, PAYOUT, RULES } from './constants.ts';
import type { GameState, Grade } from './types.ts';

export function createState(): GameState {
  return {
    phase: 'start',
    elapsed: 0,
    cash: 0,
    served: 0,
    lives: RULES.startLives,
    combo: 0,
    dogs: [],
    customers: [],
    nextDogId: 1,
    nextCustomerId: 1,
    spawnTimer: 1.0,
  };
}

/** Doneness fraction (0..~1.1) mapped to a serving grade. */
export function gradeOf(cook: number): Grade {
  if (cook < COOK.rawUntil) return 'reject'; // undercooked
  if (cook <= COOK.perfectTo) return 'perfect';
  if (cook <= COOK.goodTo) return 'good';
  if (cook < COOK.burntAt) return 'edge';
  return 'reject'; // burnt
}

export function payoutFor(grade: Grade, combo: number): number {
  const base =
    grade === 'perfect' ? PAYOUT.perfect : grade === 'good' ? PAYOUT.good : grade === 'edge' ? PAYOUT.edge : 0;
  if (base === 0) return 0;
  const bonus = Math.min(combo, PAYOUT.comboMax) * PAYOUT.comboStep;
  return base + bonus;
}

/** Seconds between customer spawns, tightening as the run goes on. */
export function spawnInterval(elapsed: number): number {
  const steps = Math.floor(elapsed / RULES.spawnRampPer);
  const interval = RULES.spawnStart - steps * 0.35;
  return Math.max(RULES.spawnMin, interval);
}

export function patienceFor(elapsed: number): number {
  const steps = Math.floor(elapsed / RULES.spawnRampPer);
  return Math.max(RULES.patienceMin, RULES.patienceStart - steps * 0.6);
}

/** Place a raw dog on an empty grill slot. Returns true if placed. */
export function startCooking(state: GameState, slot: number): boolean {
  if (state.phase !== 'playing') return false;
  if (state.dogs.some((d) => d.slot === slot)) return false;
  state.dogs.push({ id: state.nextDogId++, slot, cook: 0, state: 'cooking' });
  return true;
}

/**
 * Tap a grill slot that holds a dog:
 *  - burnt dog -> cleared, no penalty beyond wasted time
 *  - cookable dog -> serve the most impatient waiting customer.
 * Returns the grade applied (or null if nothing happened).
 */
export function serveFromSlot(state: GameState, slot: number): { grade: Grade; cash: number } | null {
  if (state.phase !== 'playing') return null;
  const dogIdx = state.dogs.findIndex((d) => d.slot === slot);
  if (dogIdx === -1) return null;
  const dog = state.dogs[dogIdx];

  if (dog.state === 'burnt') {
    state.dogs.splice(dogIdx, 1); // scrape it off
    state.combo = 0;
    return { grade: 'reject', cash: 0 };
  }

  const waiting = state.customers.filter((c) => !c.served && !c.leaving);
  if (waiting.length === 0) return null; // no one to serve; leave the dog cooking

  // serve the customer with the least patience left
  waiting.sort((a, b) => a.patience - b.patience);
  const customer = waiting[0];
  const grade = gradeOf(dog.cook);

  if (grade === 'reject') {
    // undercooked: customer refuses, dog wasted, combo broken
    state.dogs.splice(dogIdx, 1);
    state.combo = 0;
    return { grade, cash: 0 };
  }

  const gained = payoutFor(grade, state.combo);
  state.cash += gained;
  state.served += 1;
  state.combo += 1;
  customer.served = true;
  state.dogs.splice(dogIdx, 1);
  return { grade, cash: gained };
}

function spawnCustomer(state: GameState): void {
  if (state.customers.filter((c) => !c.leaving).length >= 4) return;
  const used = new Set(state.customers.filter((c) => !c.leaving).map((c) => c.slot));
  let slot = 0;
  while (used.has(slot) && slot < 4) slot++;
  if (slot >= 4) return;
  const patience = patienceFor(state.elapsed);
  state.customers.push({
    id: state.nextCustomerId++,
    slot,
    patience,
    patienceMax: patience,
    served: false,
    leaving: false,
  });
}

/**
 * Advance the simulation by dt seconds. Mutates and returns state.
 * Pure with respect to time only (no rendering, no DOM) so it is unit-testable.
 */
export function step(state: GameState, dt: number): { lostLife: boolean } {
  if (state.phase !== 'playing') return { lostLife: false };
  state.elapsed += dt;

  // cook dogs
  for (const dog of state.dogs) {
    if (dog.state === 'burnt') continue;
    dog.cook += dt / COOK.fullTime;
    if (dog.cook >= COOK.burntAt) dog.state = 'burnt';
  }

  // customers lose patience
  let lostLife = false;
  for (const c of state.customers) {
    if (c.served || c.leaving) continue;
    c.patience -= dt;
    if (c.patience <= 0) {
      c.leaving = true;
      c.patience = 0;
      state.combo = 0;
      state.lives -= 1;
      lostLife = true;
    }
  }

  // remove served/left customers after a short beat (handled by render fade; logic clears immediately)
  state.customers = state.customers.filter((c) => !c.served && !(c.leaving && c.patience <= 0));

  // spawning
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnCustomer(state);
    state.spawnTimer = spawnInterval(state.elapsed);
  }

  if (state.lives <= 0) {
    state.phase = 'gameover';
  }

  return { lostLife };
}

export function startGame(state: GameState): void {
  const fresh = createState();
  Object.assign(state, fresh, { phase: 'playing' });
}
