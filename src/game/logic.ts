import { CASH, COOK, CUSTOMER, ORDER_COMBOS, PAYOUT, RULES, SHIFT, TABLE } from './constants.ts';
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
    plates: Array.from({ length: TABLE.slots }, () => null),
    activePlate: -1,
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

/**
 * Ticket value for an assembled plate against an order. Mirrors the original economy:
 *   bun ($10) + sausage value, ketchup +$3 when wanted (−$2 when wanted but missing),
 *   drink +$7, plus a small combo bonus.
 */
export function platePayout(plate: Plate, order: Order, combo: number): number {
  let pay = 0;
  if (plate.sausage) pay += PAYOUT.bun + gradePay(plate.sausage);
  if (order.ketchup) pay += plate.ketchup ? PAYOUT.ketchup : -PAYOUT.ketchupMiss;
  if (plate.drink) pay += PAYOUT.drink;
  pay += Math.min(combo, PAYOUT.comboMax) * PAYOUT.comboStep;
  return Math.max(0, pay);
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export function generateOrder(rng: () => number = Math.random): Order {
  return { ...ORDER_COMBOS[Math.floor(rng() * ORDER_COMBOS.length)] };
}

/** Order completes when sausage presence and drink presence match. Ketchup only affects pay. */
export function plateMatchesOrder(plate: Plate, order: Order): boolean {
  return (plate.sausage !== null) === order.sausage && plate.drink === order.drink;
}

export function plateIsEmpty(plate: Plate | null): boolean {
  return !plate || (plate.sausage === null && !plate.drink && !plate.ketchup && !plate.bun);
}

function firstEmptySlot(state: GameState): number {
  return state.plates.findIndex((p) => p === null);
}

function active(state: GameState): Plate | null {
  return state.activePlate >= 0 ? state.plates[state.activePlate] : null;
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------
export function startCooking(state: GameState, slot: number): boolean {
  if (state.phase !== 'playing') return false;
  if (state.dogs.some((d) => d.slot === slot)) return false;
  state.dogs.push({ id: state.nextDogId++, slot, cook: 0 });
  return true;
}

export type GrillResult = 'cooking' | 'tossed' | 'plated' | 'need-bun' | 'busy' | 'none';

/** Tap a grill slot: empty -> cook; burnt -> toss; cooked -> move onto the active bun. */
export function tapGrill(state: GameState, slot: number): GrillResult {
  if (state.phase !== 'playing') return 'none';
  const idx = state.dogs.findIndex((d) => d.slot === slot);
  if (idx === -1) return startCooking(state, slot) ? 'cooking' : 'none';

  const dog = state.dogs[idx];
  if (isBurnt(dog.cook)) {
    state.dogs.splice(idx, 1);
    return 'tossed';
  }
  const p = active(state);
  if (!p || !p.bun) return 'need-bun';
  if (p.sausage !== null) return 'busy';
  p.sausage = gradeOf(dog.cook);
  state.dogs.splice(idx, 1);
  return 'plated';
}

export type TableResult = 'selected' | 'noop';

/** Tap a prep-table slot to make it the active plate you're topping. */
export function selectPlate(state: GameState, slot: number): TableResult {
  if (state.phase !== 'playing') return 'noop';
  if (slot < 0 || slot >= state.plates.length) return 'noop';
  if (state.plates[slot] === null) return 'noop';
  state.activePlate = slot;
  return 'selected';
}

export type StationResult = 'ok' | 'noop';

export function useStation(state: GameState, station: Station): StationResult {
  if (state.phase !== 'playing') return 'noop';
  const p = active(state);
  switch (station) {
    case 'bun': {
      const slot = firstEmptySlot(state);
      if (slot === -1) return 'noop'; // table full
      state.plates[slot] = { bun: true, sausage: null, ketchup: false, drink: false };
      state.activePlate = slot;
      return 'ok';
    }
    case 'ketchup':
      if (p && p.sausage !== null && !p.ketchup) {
        p.ketchup = true;
        return 'ok';
      }
      return 'noop';
    case 'drink': {
      if (p && !p.drink) {
        p.drink = true;
        return 'ok';
      }
      if (!p) {
        const slot = firstEmptySlot(state);
        if (slot === -1) return 'noop';
        state.plates[slot] = { bun: false, sausage: null, ketchup: false, drink: true };
        state.activePlate = slot;
        return 'ok';
      }
      return 'noop';
    }
    case 'trash':
      if (state.activePlate >= 0 && state.plates[state.activePlate]) {
        state.plates[state.activePlate] = null;
        state.activePlate = -1;
        state.combo = 0;
        return 'ok';
      }
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

/** Hand the active plate to the customer in `slot`. */
export function serveCustomer(state: GameState, slot: number): ServeResult {
  if (state.phase !== 'playing') return { ok: false, payout: 0, reason: 'no-customer' };
  const customer = state.customers.find((c) => c.slot === slot && !c.served && !c.leaving);
  if (!customer) return { ok: false, payout: 0, reason: 'no-customer' };

  const p = active(state);
  if (plateIsEmpty(p)) return { ok: false, payout: 0, reason: 'empty-plate' };
  const plate = p as Plate;

  const clearActive = () => {
    state.plates[state.activePlate] = null;
    state.activePlate = -1;
  };

  if (!plateMatchesOrder(plate, customer.order)) {
    clearActive();
    state.combo = 0;
    state.wrong += 1;
    return { ok: false, payout: 0, reason: 'wrong-order' };
  }

  const payout = platePayout(plate, customer.order, state.combo);
  customer.served = true;
  state.combo += 1;
  state.served += 1;
  clearActive();
  spawnCashToken(state, slot, payout);
  return { ok: true, payout, reason: 'served' };
}

function spawnCashToken(state: GameState, slot: number, amount: number): void {
  const r = customerSlotRect(slot);
  state.cashTokens.push({ id: state.nextTokenId++, amount, x: r.x + r.w / 2, y: r.y + r.h + 18, life: CASH.life });
  state.pending += amount;
}

export function collectToken(state: GameState, tokenId: number): number {
  const idx = state.cashTokens.findIndex((t) => t.id === tokenId);
  if (idx === -1) return 0;
  const { amount } = state.cashTokens[idx];
  state.cash += amount;
  state.pending -= amount;
  state.cashTokens.splice(idx, 1);
  return amount;
}

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
  const activeCustomers = state.customers.filter((c) => !c.leaving);
  if (activeCustomers.length >= CUSTOMER.max) return;
  const used = new Set(activeCustomers.map((c) => c.slot));
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
    appear: 0,
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
    if (c.appear < 1) c.appear = Math.min(1, c.appear + dt * 4);
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

  for (const t of state.cashTokens) t.life -= dt;
  for (const t of state.cashTokens.filter((t) => t.life <= 0)) state.pending -= t.amount;
  state.cashTokens = state.cashTokens.filter((t) => t.life > 0);

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnCustomer(state, rng);
    state.spawnTimer = RULES.spawnInterval;
  }

  if (state.timeLeft <= 0 && state.phase === 'playing') {
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
