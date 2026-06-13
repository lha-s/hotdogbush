import { CASH, COOK, CUSTOMER, ORDER_COMBOS, PAYOUT, RULES, SHIFT } from './constants.ts';
import { customerSlotRect } from './geometry.ts';
import type { CashToken, Customer, GameState, Grade, Order, Plate, Station } from './types.ts';

export function createState(): GameState {
  return {
    phase: 'start',
    elapsed: 0,
    timeLeft: SHIFT.duration,
    cash: 0,
    pending: 0,
    served: 0,
    missed: 0,
    wrong: 0,
    combo: 0,
    dogs: [],
    customers: [],
    plate: null,
    cashTokens: [],
    nextDogId: 1,
    nextCustomerId: 1,
    nextTokenId: 1,
    spawnTimer: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Cooking
// ---------------------------------------------------------------------------
export function gradeOf(cookSeconds: number): Grade {
  if (cookSeconds < COOK.perfectFrom) return 'good';
  if (cookSeconds < COOK.overdoneFrom) return 'perfect';
  return 'overdone';
}

export function isBurnt(cookSeconds: number): boolean {
  return cookSeconds >= COOK.burntFrom;
}

function gradePay(grade: Grade): number {
  return grade === 'perfect' ? PAYOUT.perfect : grade === 'good' ? PAYOUT.good : PAYOUT.overdone;
}

/** Total ticket value for an assembled plate (sausage doneness + ketchup + drink + combo). */
export function platePayout(plate: Plate, combo: number): number {
  let total = 0;
  if (plate.sausage) total += gradePay(plate.sausage);
  if (plate.ketchup) total += PAYOUT.ketchup;
  if (plate.drink) total += PAYOUT.drink;
  total += Math.min(combo, PAYOUT.comboMax) * PAYOUT.comboStep;
  return total;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export function generateOrder(rng: () => number = Math.random): Order {
  const combo = ORDER_COMBOS[Math.floor(rng() * ORDER_COMBOS.length)];
  return { ...combo };
}

export function plateMatchesOrder(plate: Plate, order: Order): boolean {
  return (plate.sausage !== null) === order.sausage && plate.ketchup === order.ketchup && plate.drink === order.drink;
}

export function plateIsEmpty(plate: Plate | null): boolean {
  return !plate || (plate.sausage === null && !plate.drink && !plate.ketchup);
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

/** Tap an empty grill slot to start cooking a sausage. */
export function startCooking(state: GameState, slot: number): boolean {
  if (state.phase !== 'playing') return false;
  if (state.dogs.some((d) => d.slot === slot)) return false;
  state.dogs.push({ id: state.nextDogId++, slot, cook: 0 });
  return true;
}

export type GrillResult = 'cooking' | 'tossed' | 'plated' | 'need-bun' | 'busy' | 'none';

/** Tap a grill slot: empty -> cook; burnt -> toss; cooked -> move onto the bun on the plate. */
export function tapGrill(state: GameState, slot: number): GrillResult {
  if (state.phase !== 'playing') return 'none';
  const idx = state.dogs.findIndex((d) => d.slot === slot);
  if (idx === -1) return startCooking(state, slot) ? 'cooking' : 'none';

  const dog = state.dogs[idx];
  if (isBurnt(dog.cook)) {
    state.dogs.splice(idx, 1); // scrape the burnt one into the trash
    return 'tossed';
  }
  if (!state.plate || !state.plate.bun) return 'need-bun';
  if (state.plate.sausage !== null) return 'busy'; // already has a sausage on the bun
  state.plate.sausage = gradeOf(dog.cook);
  state.dogs.splice(idx, 1);
  return 'plated';
}

export type StationResult = 'ok' | 'noop';

/** Tap a counter station to add to / clear the plate. */
export function useStation(state: GameState, station: Station): StationResult {
  if (state.phase !== 'playing') return 'noop';
  const p = state.plate;
  switch (station) {
    case 'bun':
      if (!p) {
        state.plate = { bun: true, sausage: null, ketchup: false, drink: false };
        return 'ok';
      }
      return 'noop';
    case 'ketchup':
      if (p && p.sausage !== null && !p.ketchup) {
        p.ketchup = true;
        return 'ok';
      }
      return 'noop';
    case 'drink':
      if (!p) {
        state.plate = { bun: false, sausage: null, ketchup: false, drink: true };
        return 'ok';
      }
      if (!p.drink) {
        p.drink = true;
        return 'ok';
      }
      return 'noop';
    case 'trash':
      if (p) {
        state.plate = null; // bin the current build (even a lone bun)
        state.combo = 0;
        return 'ok';
      }
      // nothing on the plate: scrape the most-burnt sausage off the grill, if any
      {
        const burntIdx = state.dogs.findIndex((d) => isBurnt(d.cook));
        if (burntIdx !== -1) {
          state.dogs.splice(burntIdx, 1);
          return 'ok';
        }
      }
      return 'noop';
  }
}

export interface ServeResult {
  ok: boolean;
  payout: number;
  reason: 'served' | 'wrong-order' | 'empty-plate' | 'no-customer';
}

/** Hand the current plate to the customer in `slot`. */
export function serveCustomer(state: GameState, slot: number): ServeResult {
  if (state.phase !== 'playing') return { ok: false, payout: 0, reason: 'no-customer' };
  const customer = state.customers.find((c) => c.slot === slot && !c.served && !c.leaving);
  if (!customer) return { ok: false, payout: 0, reason: 'no-customer' };
  if (plateIsEmpty(state.plate)) return { ok: false, payout: 0, reason: 'empty-plate' };

  const plate = state.plate as Plate;
  if (!plateMatchesOrder(plate, customer.order)) {
    state.plate = null; // wrong build is wasted
    state.combo = 0;
    state.wrong += 1;
    return { ok: false, payout: 0, reason: 'wrong-order' };
  }

  const payout = platePayout(plate, state.combo);
  customer.served = true;
  state.combo += 1;
  state.served += 1;
  state.plate = null;
  spawnCashToken(state, slot, payout);
  return { ok: true, payout, reason: 'served' };
}

function spawnCashToken(state: GameState, slot: number, amount: number): void {
  const r = customerSlotRect(slot);
  state.cashTokens.push({
    id: state.nextTokenId++,
    amount,
    x: r.x + r.w / 2,
    y: r.y + r.h - 8,
    life: CASH.life,
  });
  state.pending += amount;
}

/** Collect a cash token (by tap). Returns the amount collected, or 0 if none there. */
export function collectToken(state: GameState, tokenId: number): number {
  const idx = state.cashTokens.findIndex((t) => t.id === tokenId);
  if (idx === -1) return 0;
  const { amount } = state.cashTokens[idx];
  state.cash += amount;
  state.pending -= amount;
  state.cashTokens.splice(idx, 1);
  return amount;
}

/** Topmost cash token under a point, or null. */
export function tokenAt(state: GameState, px: number, py: number): CashToken | null {
  for (let i = state.cashTokens.length - 1; i >= 0; i--) {
    const t = state.cashTokens[i];
    if ((px - t.x) ** 2 + (py - t.y) ** 2 <= CASH.radius ** 2) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
function spawnCustomer(state: GameState, rng: () => number): void {
  const active = state.customers.filter((c) => !c.leaving);
  if (active.length >= CUSTOMER.max) return;
  const used = new Set(active.map((c) => c.slot));
  let slot = 0;
  while (used.has(slot) && slot < CUSTOMER.max) slot++;
  if (slot >= CUSTOMER.max) return;
  const c: Customer = {
    id: state.nextCustomerId++,
    slot,
    order: generateOrder(rng),
    patience: RULES.patience,
    patienceMax: RULES.patience,
    served: false,
    leaving: false,
  };
  state.customers.push(c);
}

export function step(state: GameState, dt: number, rng: () => number = Math.random): { missed: boolean } {
  if (state.phase !== 'playing') return { missed: false };
  state.elapsed += dt;
  state.timeLeft = Math.max(0, state.timeLeft - dt);

  for (const dog of state.dogs) dog.cook += dt;

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
  state.customers = state.customers.filter((c) => !c.served && !(c.leaving && c.patience <= 0));

  // cash tokens expire (uncollected cash is lost)
  for (const t of state.cashTokens) t.life -= dt;
  const expired = state.cashTokens.filter((t) => t.life <= 0);
  for (const t of expired) state.pending -= t.amount;
  state.cashTokens = state.cashTokens.filter((t) => t.life > 0);

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnCustomer(state, rng);
    state.spawnTimer = RULES.spawnInterval;
  }

  if (state.timeLeft <= 0 && state.phase === 'playing') {
    // shift's over — sweep any cash still on the counter into the till
    state.cash += state.pending;
    state.pending = 0;
    state.cashTokens = [];
    state.phase = 'gameover';
  }
  return { missed };
}

export function startGame(state: GameState): void {
  Object.assign(state, createState(), { phase: 'playing' });
}
