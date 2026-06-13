import { APPLIANCE_COOK, CASH, COOK, CUSTOMER, PATIENCE, PAYOUT, PHASES, SHIFT, SPAWN, TABLE, UNLOCK } from './constants.ts';
import { customerSlotRect } from './geometry.ts';
import type { CashToken, CookItem, CookStation, Customer, GameState, Grade, Order, Plate } from './types.ts';

// ---------------------------------------------------------------------------
// Speed-mode progression (pure, DOM-free, unit-testable)
// ---------------------------------------------------------------------------
export type ShiftPhase = 'WARMUP' | 'RUSH' | 'PEAK' | 'CRUNCH';

export function phaseOf(elapsed: number): ShiftPhase {
  if (elapsed < PHASES.RUSH) return 'WARMUP';
  if (elapsed < PHASES.PEAK) return 'RUSH';
  if (elapsed < PHASES.CRUNCH) return 'PEAK';
  return 'CRUNCH';
}

const PHASE_INDEX: Record<ShiftPhase, number> = { WARMUP: 0, RUSH: 1, PEAK: 2, CRUNCH: 3 };

/** Seconds until the next customer. Base gap lerps startGap -> minGap by `rampTo`, then ±jitter. */
export function spawnGap(elapsed: number, rng: () => number = Math.random): number {
  const t = Math.min(1, Math.max(0, elapsed / SPAWN.rampTo));
  const base = SPAWN.startGap + (SPAWN.minGap - SPAWN.startGap) * t;
  const jittered = base * (1 + (rng() * 2 - 1) * SPAWN.jitter);
  return Math.min(SPAWN.startGap, Math.max(SPAWN.minGap, jittered));
}

/** Customer patience for the current phase (15 / 13 / 11 / 9 s), floored. */
export function patienceFor(elapsed: number): number {
  const p = PATIENCE.base - PATIENCE.perPhaseDrop * PHASE_INDEX[phaseOf(elapsed)];
  return Math.max(PATIENCE.min, p);
}

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

/** Doneness of a cook item using its appliance's bands (grill / fryer / pan). */
export function gradeOfItem(item: CookItem): Grade {
  const b = APPLIANCE_COOK[item.station];
  if (item.cook < b.perfectFrom) return 'good';
  if (item.cook < b.overdoneFrom) return 'perfect';
  return 'overdone';
}

export function isBurntItem(item: CookItem): boolean {
  return item.cook >= APPLIANCE_COOK[item.station].burntFrom;
}

function gradePay(grade: Grade): number {
  return grade === 'perfect' ? PAYOUT.perfect : grade === 'good' ? PAYOUT.good : PAYOUT.overdone;
}

function friesPay(grade: Grade): number {
  return grade === 'perfect' ? PAYOUT.friesPerfect : grade === 'good' ? PAYOUT.friesGood : PAYOUT.friesOverdone;
}

/**
 * Ticket value for an assembled plate against an order. Mirrors the original economy:
 *   bun ($10) + sausage value, ketchup +$3 when wanted (−$2 when wanted but missing),
 *   drink +$7, plus a small combo bonus.
 */
export function platePayout(plate: Plate, order: Order, combo: number): number {
  let pay = 0;
  if (plate.sausage) pay += PAYOUT.bun + gradePay(plate.sausage);
  if (plate.patty) pay += PAYOUT.burgerBun + gradePay(plate.patty);
  if (plate.fries) pay += friesPay(plate.fries);
  if (order.ketchup) pay += plate.ketchup ? PAYOUT.ketchup : -PAYOUT.ketchupMiss;
  if (order.onion) pay += plate.onion ? PAYOUT.onion : -PAYOUT.onionMiss;
  if (plate.drink) pay += PAYOUT.drink;
  pay += Math.min(combo, PAYOUT.comboMax) * PAYOUT.comboStep;
  return Math.max(0, pay);
}

/** A fresh, empty plate with all components cleared. */
function emptyPlate(over: Partial<Plate> = {}): Plate {
  return { bun: false, burgerBun: false, sausage: null, patty: null, fries: null, onion: false, ketchup: false, mustard: false, drink: false, ...over };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
/** Time-aware order generation: only includes items unlocked by `elapsed`. */
export function generateOrder(rng: () => number = Math.random, elapsed = Infinity): Order {
  const useBurger = elapsed >= UNLOCK.burger && rng() < 0.45;
  return {
    sausage: !useBurger,
    burger: useBurger,
    ketchup: rng() < 0.4,
    onion: elapsed >= UNLOCK.onion && useBurger && rng() < 0.4, // onions ride on burgers
    mustard: false, // unlocked in a later phase
    drink: rng() < 0.4,
    fries: elapsed >= UNLOCK.fries && rng() < 0.45,
  };
}

/** Order completes when every wanted FOOD is present. Condiments (ketchup/mustard/onion) are pay-only. */
export function plateMatchesOrder(plate: Plate, order: Order): boolean {
  return (
    (plate.sausage !== null) === order.sausage &&
    (plate.patty !== null) === order.burger &&
    (plate.fries !== null) === order.fries &&
    plate.drink === order.drink
  );
}

export function plateIsEmpty(plate: Plate | null): boolean {
  // A lone bun isn't servable — only real contents count.
  return !plate || (plate.sausage === null && plate.patty === null && plate.fries === null && !plate.drink && !plate.ketchup);
}

function firstEmptySlot(state: GameState): number {
  return state.plates.findIndex((p) => p === null);
}

// ---------------------------------------------------------------------------
// Taps (no drag): cook / toss a burnt dog / drop a fresh bun on the table
// ---------------------------------------------------------------------------
function itemAt(state: GameState, station: CookStation, slot: number): CookItem | undefined {
  return state.dogs.find((d) => d.station === station && d.slot === slot);
}

/** Start cooking on an appliance slot. Returns false if that slot is occupied. */
function startOn(state: GameState, station: CookStation, slot: number, kind: CookItem['kind']): boolean {
  if (state.phase !== 'playing') return false;
  if (itemAt(state, station, slot)) return false;
  state.dogs.push({ id: state.nextDogId++, kind, station, slot, cook: 0 });
  return true;
}

export function startCooking(state: GameState, slot: number, kind: 'sausage' | 'patty' = 'sausage'): boolean {
  return startOn(state, 'grill', slot, kind);
}
export function startFrying(state: GameState, slot: number): boolean {
  return startOn(state, 'fryer', slot, 'fries');
}
export function startPan(state: GameState, slot: number): boolean {
  return startOn(state, 'pan', slot, 'onion');
}

export type GrillTap = 'cooking' | 'tossed' | 'grab' | 'none';

/** Tap an appliance slot: empty grill -> cook sausage; burnt -> toss; cooked -> nothing (drag it). */
export function tapAppliance(state: GameState, station: CookStation, slot: number): GrillTap {
  if (state.phase !== 'playing') return 'none';
  const item = itemAt(state, station, slot);
  if (!item) return station === 'grill' && startCooking(state, slot) ? 'cooking' : 'none';
  if (isBurntItem(item)) {
    state.dogs = state.dogs.filter((d) => d !== item);
    return 'tossed';
  }
  return 'grab';
}

/** Back-compat: tapping a grill slot. */
export function tapGrill(state: GameState, slot: number): GrillTap {
  return tapAppliance(state, 'grill', slot);
}

/** Tap the Bun station to place a fresh hot-dog bun on the next empty table plate. Returns slot or -1. */
export function placeBun(state: GameState): number {
  if (state.phase !== 'playing') return -1;
  const slot = firstEmptySlot(state);
  if (slot === -1) return -1;
  state.plates[slot] = emptyPlate({ bun: true });
  return slot;
}

/** Tap the Burger-Bun station to place a fresh burger bun on the next empty table plate. */
export function placeBurgerBun(state: GameState): number {
  if (state.phase !== 'playing') return -1;
  const slot = firstEmptySlot(state);
  if (slot === -1) return -1;
  state.plates[slot] = emptyPlate({ burgerBun: true });
  return slot;
}

// ---------------------------------------------------------------------------
// Drag & drop
// ---------------------------------------------------------------------------
export type DropResult = 'ok' | 'need-bun' | 'busy' | 'bad';

/** Drag a cooked item from an appliance onto the table (the matching bun, or a fries/onion target). */
export function dropCookedOnPlate(state: GameState, itemId: number, plateSlot: number): DropResult {
  if (state.phase !== 'playing') return 'bad';
  const item = state.dogs.find((d) => d.id === itemId);
  if (!item || isBurntItem(item)) return 'bad';
  const plate = state.plates[plateSlot];
  const grade = gradeOfItem(item);

  if (item.kind === 'fries') {
    // fries need no bun; they can even start a fresh plate on an empty slot
    if (!plate) state.plates[plateSlot] = emptyPlate({ fries: grade });
    else if (plate.fries === null) plate.fries = grade;
    else return 'busy';
  } else if (item.kind === 'onion') {
    // onion is a topping: it needs a protein already on the plate
    if (!plate || (plate.sausage === null && plate.patty === null)) return 'bad';
    if (plate.onion) return 'busy';
    plate.onion = true;
  } else if (item.kind === 'sausage') {
    if (!plate || !plate.bun) return 'need-bun';
    if (plate.sausage !== null) return 'busy';
    plate.sausage = grade;
  } else if (item.kind === 'patty') {
    if (!plate || !plate.burgerBun) return 'need-bun';
    if (plate.patty !== null) return 'busy';
    plate.patty = grade;
  } else {
    return 'bad';
  }
  state.dogs = state.dogs.filter((d) => d.id !== itemId);
  return 'ok';
}

/** Drag the ketchup bottle onto a protein. */
export function dropKetchup(state: GameState, plateSlot: number): boolean {
  if (state.phase !== 'playing') return false;
  const plate = state.plates[plateSlot];
  if (plate && (plate.sausage !== null || plate.patty !== null) && !plate.ketchup) {
    plate.ketchup = true;
    return true;
  }
  return false;
}

/** Drag a drink onto a plate (or onto an empty table slot to start a drink-only order). */
export function dropDrink(state: GameState, plateSlot: number): boolean {
  if (state.phase !== 'playing') return false;
  const plate = state.plates[plateSlot];
  if (plate) {
    if (plate.drink) return false;
    plate.drink = true;
    return true;
  }
  state.plates[plateSlot] = emptyPlate({ drink: true });
  return true;
}

/** Drag a cook item into the trash. */
export function trashItem(state: GameState, itemId: number): boolean {
  const before = state.dogs.length;
  state.dogs = state.dogs.filter((d) => d.id !== itemId);
  return state.dogs.length < before;
}

export function trashPlate(state: GameState, plateSlot: number): boolean {
  if (state.plates[plateSlot]) {
    state.plates[plateSlot] = null;
    state.combo = 0;
    return true;
  }
  return false;
}

export interface ServeResult {
  ok: boolean;
  payout: number;
  reason: 'served' | 'wrong-order' | 'empty-plate' | 'no-customer';
}

/** Drag an assembled plate from the table to a customer. */
export function servePlate(state: GameState, plateSlot: number, customerSlot: number): ServeResult {
  if (state.phase !== 'playing') return { ok: false, payout: 0, reason: 'no-customer' };
  const customer = state.customers.find((c) => c.slot === customerSlot && !c.served && !c.leaving);
  if (!customer) return { ok: false, payout: 0, reason: 'no-customer' };
  const plate = state.plates[plateSlot];
  if (plateIsEmpty(plate)) return { ok: false, payout: 0, reason: 'empty-plate' };
  const p = plate as Plate;

  if (!plateMatchesOrder(p, customer.order)) {
    state.plates[plateSlot] = null;
    state.combo = 0;
    state.wrong += 1;
    return { ok: false, payout: 0, reason: 'wrong-order' };
  }

  const payout = platePayout(p, customer.order, state.combo);
  customer.served = true;
  state.combo += 1;
  state.served += 1;
  state.plates[plateSlot] = null;
  spawnCashToken(state, customerSlot, payout);
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
  const patience = patienceFor(state.elapsed);
  const c: Customer = {
    id: state.nextCustomerId++,
    slot,
    order: generateOrder(rng, state.elapsed),
    patience,
    patienceMax: patience,
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
    state.spawnTimer = spawnGap(state.elapsed, rng);
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
