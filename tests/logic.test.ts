import { describe, expect, test } from 'vitest';
import { CASH, COOK, ORDER_COMBOS, PATIENCE, PAYOUT, PHASES, SHIFT, SPAWN } from '../src/game/constants.ts';
import {
  collectToken,
  createState,
  dropDrink,
  dropKetchup,
  dropSausageOnPlate,
  generateOrder,
  gradeOf,
  isBurnt,
  patienceFor,
  phaseOf,
  placeBun,
  plateMatchesOrder,
  platePayout,
  servePlate,
  spawnGap,
  startCooking,
  startGame,
  step,
  tapGrill,
  tokenAt,
  trashPlate,
  trashSausage,
} from '../src/game/logic.ts';
import type { GameState, Order, Plate } from '../src/game/types.ts';

function playing(): GameState {
  const s = createState();
  startGame(s);
  return s;
}
function addCustomer(s: GameState, order: Order, slot = 0): void {
  s.customers.push({ id: 99, slot, order, patience: 10, patienceMax: 10, served: false, leaving: false, appear: 1 });
}
const plate = (p: Partial<Plate>): Plate => ({ bun: false, sausage: null, ketchup: false, drink: false, ...p });

/** Cook a sausage in slot 0 to `cook` seconds and return its id. */
function cookOne(s: GameState, cook: number): number {
  startCooking(s, 0);
  s.dogs[0].cook = cook;
  return s.dogs[0].id;
}

describe('cooking grades & burn', () => {
  test('doneness bands follow the original 7s / 14s steps', () => {
    expect(gradeOf(0)).toBe('good');
    expect(gradeOf(COOK.perfectFrom)).toBe('perfect');
    expect(gradeOf(COOK.overdoneFrom)).toBe('overdone');
  });
  test('burnt only past the burnt threshold', () => {
    expect(isBurnt(COOK.burntFrom - 0.1)).toBe(false);
    expect(isBurnt(COOK.burntFrom)).toBe(true);
  });
});

describe('economy (bun $10 + sausage + ketchup $3 + drink $7)', () => {
  test('plain perfect dog = bun + perfect sausage', () => {
    const o: Order = { sausage: true, ketchup: false, drink: false };
    expect(platePayout(plate({ bun: true, sausage: 'perfect' }), o, 0)).toBe(PAYOUT.bun + PAYOUT.perfect);
  });
  test('loaded dog + drink sums every item', () => {
    const o: Order = { sausage: true, ketchup: true, drink: true };
    const pay = platePayout(plate({ bun: true, sausage: 'perfect', ketchup: true, drink: true }), o, 0);
    expect(pay).toBe(PAYOUT.bun + PAYOUT.perfect + PAYOUT.ketchup + PAYOUT.drink);
  });
  test('wanted-but-missing ketchup docks pay (still sells)', () => {
    const o: Order = { sausage: true, ketchup: true, drink: false };
    expect(platePayout(plate({ bun: true, sausage: 'perfect' }), o, 0)).toBe(PAYOUT.bun + PAYOUT.perfect - PAYOUT.ketchupMiss);
  });
  test('drink-only pays the drink value', () => {
    expect(platePayout(plate({ drink: true }), { sausage: false, ketchup: false, drink: true }, 0)).toBe(PAYOUT.drink);
  });
});

describe('order matching (ketchup is a modifier, not a gate)', () => {
  test('completes on sausage + drink presence, ignoring ketchup', () => {
    const o: Order = { sausage: true, ketchup: true, drink: false };
    expect(plateMatchesOrder(plate({ bun: true, sausage: 'good' }), o)).toBe(true);
    expect(plateMatchesOrder(plate({ bun: true, sausage: 'good', drink: true }), o)).toBe(false);
  });
  test('generateOrder yields canonical combos', () => {
    for (let i = 0; i < ORDER_COMBOS.length; i++) {
      expect(ORDER_COMBOS).toContainEqual(generateOrder(() => i / ORDER_COMBOS.length));
    }
  });
});

describe('taps: cook, toss, place bun', () => {
  test('tapping an empty grill slot starts cooking; a cooked one says grab (drag it)', () => {
    const s = playing();
    expect(tapGrill(s, 0)).toBe('cooking');
    s.dogs[0].cook = 10;
    expect(tapGrill(s, 0)).toBe('grab');
  });
  test('tapping a burnt grill slot tosses it', () => {
    const s = playing();
    cookOne(s, COOK.burntFrom + 1);
    expect(tapGrill(s, 0)).toBe('tossed');
    expect(s.dogs).toHaveLength(0);
  });
  test('Bun fills the next empty table slot, then refuses when full', () => {
    const s = playing();
    expect(placeBun(s)).toBe(0);
    expect(placeBun(s)).toBe(1);
    expect(placeBun(s)).toBe(2);
    expect(placeBun(s)).toBe(-1);
  });
});

describe('drag & drop assembly', () => {
  test('drag a cooked sausage onto a bun', () => {
    const s = playing();
    const slot = placeBun(s);
    const id = cookOne(s, 10);
    expect(dropSausageOnPlate(s, id, slot)).toBe('ok');
    expect(s.plates[slot]?.sausage).toBe('perfect');
    expect(s.dogs).toHaveLength(0);
  });
  test('sausage needs a bun, and a bun holds only one', () => {
    const s = playing();
    const id = cookOne(s, 10);
    expect(dropSausageOnPlate(s, id, 0)).toBe('need-bun'); // empty slot
    const slot = placeBun(s);
    expect(dropSausageOnPlate(s, id, slot)).toBe('ok');
    const id2 = cookOne(s, 10);
    expect(dropSausageOnPlate(s, id2, slot)).toBe('busy');
  });
  test('a burnt sausage cannot be plated', () => {
    const s = playing();
    const slot = placeBun(s);
    const id = cookOne(s, COOK.burntFrom + 1);
    expect(dropSausageOnPlate(s, id, slot)).toBe('bad');
  });
  test('drag ketchup onto a dog; drag a drink onto a plate or empty slot', () => {
    const s = playing();
    const slot = placeBun(s);
    const id = cookOne(s, 10);
    dropSausageOnPlate(s, id, slot);
    expect(dropKetchup(s, slot)).toBe(true);
    expect(s.plates[slot]?.ketchup).toBe(true);
    expect(dropDrink(s, slot)).toBe(true);
    expect(dropDrink(s, 2)).toBe(true); // empty slot -> drink-only plate
    expect(s.plates[2]).toEqual({ bun: false, sausage: null, ketchup: false, drink: true });
  });
});

describe('trash', () => {
  test('trash a sausage and trash a plate', () => {
    const s = playing();
    s.combo = 4;
    const id = cookOne(s, 10);
    expect(trashSausage(s, id)).toBe(true);
    expect(s.dogs).toHaveLength(0);
    const slot = placeBun(s);
    expect(trashPlate(s, slot)).toBe(true);
    expect(s.plates[slot]).toBeNull();
    expect(s.combo).toBe(0);
  });
});

describe('serving + cash collection', () => {
  function buildDog(s: GameState, slot: number, cook = 10): void {
    const id = cookOne(s, cook);
    dropSausageOnPlate(s, id, slot);
  }

  test('drag a matching plate to a customer: serves, spawns a token, defers cash', () => {
    const s = playing();
    addCustomer(s, { sausage: true, ketchup: false, drink: false });
    const slot = placeBun(s);
    buildDog(s, slot);
    const res = servePlate(s, slot, 0);
    expect(res.ok).toBe(true);
    expect(res.payout).toBe(PAYOUT.bun + PAYOUT.perfect);
    expect(s.cashTokens).toHaveLength(1);
    expect(s.cash).toBe(0);
    expect(s.pending).toBe(res.payout);
    expect(s.plates[slot]).toBeNull();
  });
  test('missing wanted ketchup still serves, for less', () => {
    const s = playing();
    addCustomer(s, { sausage: true, ketchup: true, drink: false });
    const slot = placeBun(s);
    buildDog(s, slot);
    const res = servePlate(s, slot, 0);
    expect(res.ok).toBe(true);
    expect(res.payout).toBe(PAYOUT.bun + PAYOUT.perfect - PAYOUT.ketchupMiss);
  });
  test('wrong sausage/drink presence is rejected and breaks combo', () => {
    const s = playing();
    s.combo = 3;
    addCustomer(s, { sausage: true, ketchup: false, drink: false });
    const slot = placeBun(s);
    buildDog(s, slot);
    dropDrink(s, slot); // unwanted drink
    const res = servePlate(s, slot, 0);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('wrong-order');
    expect(s.combo).toBe(0);
    expect(s.wrong).toBe(1);
  });
  test('serving an empty plate / missing customer is a no-op result', () => {
    const s = playing();
    addCustomer(s, { sausage: true, ketchup: false, drink: false });
    placeBun(s);
    expect(servePlate(s, 0, 0).reason).toBe('empty-plate'); // bun only counts as empty
    expect(servePlate(s, 1, 3).reason).toBe('no-customer');
  });
  test('collecting the token moves pending into cash', () => {
    const s = playing();
    addCustomer(s, { sausage: false, ketchup: false, drink: true });
    dropDrink(s, 0);
    servePlate(s, 0, 0);
    const tok = s.cashTokens[0];
    expect(tokenAt(s, tok.x, tok.y)?.id).toBe(tok.id);
    expect(collectToken(s, tok.id)).toBe(PAYOUT.drink);
    expect(s.cash).toBe(PAYOUT.drink);
    expect(s.pending).toBe(0);
  });
});

describe('step / shift', () => {
  test('cooking accrues in real seconds', () => {
    const s = playing();
    startCooking(s, 0);
    step(s, 8, () => 0);
    expect(s.dogs[0].cook).toBeCloseTo(8);
  });
  test('patience starts at the original 15 seconds; running out is a miss', () => {
    expect(patienceFor(0)).toBe(15);
    const s = playing();
    s.combo = 4;
    addCustomer(s, { sausage: true, ketchup: false, drink: false });
    s.customers[0].patience = 0.5;
    const { missed } = step(s, 1, () => 0);
    expect(missed).toBe(true);
    expect(s.missed).toBe(1);
    expect(s.combo).toBe(0);
  });
  test('the clock ends the game and sweeps pending cash into the score', () => {
    const s = playing();
    addCustomer(s, { sausage: false, ketchup: false, drink: true });
    dropDrink(s, 0);
    servePlate(s, 0, 0);
    s.timeLeft = 0.5;
    step(s, 1, () => 0);
    expect(s.timeLeft).toBe(0);
    expect(s.phase).toBe('gameover');
    expect(s.cash).toBe(PAYOUT.drink);
  });
  test('uncollected cash expires before the buzzer', () => {
    const s = playing();
    addCustomer(s, { sausage: false, ketchup: false, drink: true });
    dropDrink(s, 0);
    servePlate(s, 0, 0);
    step(s, CASH.life + 0.1, () => 0);
    expect(s.cashTokens).toHaveLength(0);
    expect(s.pending).toBe(0);
    expect(s.cash).toBe(0);
  });
  test('customers keep spawning (regression: timer stays finite) and animate in', () => {
    const s = playing();
    // simulate the full shift in small ticks; the spawn timer must never go undefined
    for (let i = 0; i < 900; i++) {
      step(s, 0.1, () => 0.5);
      expect(Number.isFinite(s.spawnTimer)).toBe(true);
    }
    expect(s.served + s.missed + s.customers.length).toBeGreaterThan(3); // many customers arrived
  });

  test('a fresh customer animates in over the next tick', () => {
    const s = playing();
    s.spawnTimer = 0.05;
    step(s, 0.1, () => 0.5);
    expect(s.customers.length).toBeGreaterThanOrEqual(1);
    step(s, 0.1, () => 0.5);
    expect(s.customers[0].appear).toBeGreaterThan(0);
  });
  test('shift is 90 seconds', () => {
    expect(SHIFT.duration).toBe(90);
    expect(createState().timeLeft).toBe(90);
  });
  test('a paused game is frozen by step()', () => {
    const s = playing();
    startCooking(s, 0);
    s.phase = 'paused';
    const before = { elapsed: s.elapsed, timeLeft: s.timeLeft, cook: s.dogs[0].cook };
    step(s, 5, () => 0.5);
    expect(s.elapsed).toBe(before.elapsed);
    expect(s.timeLeft).toBe(before.timeLeft);
    expect(s.dogs[0].cook).toBe(before.cook);
  });
});

describe('speed-mode progression helpers', () => {
  test('phaseOf boundaries', () => {
    expect(phaseOf(PHASES.RUSH - 0.1)).toBe('WARMUP');
    expect(phaseOf(PHASES.RUSH)).toBe('RUSH');
    expect(phaseOf(PHASES.PEAK)).toBe('PEAK');
    expect(phaseOf(PHASES.CRUNCH)).toBe('CRUNCH');
  });

  test('spawnGap shrinks over the shift and stays clamped', () => {
    const mid = () => 0.5; // no jitter at 0.5
    const early = spawnGap(0, mid);
    const late = spawnGap(SPAWN.rampTo, mid);
    expect(early).toBeCloseTo(SPAWN.startGap);
    expect(late).toBeCloseTo(SPAWN.minGap);
    expect(spawnGap(20, mid)).toBeLessThan(early);
    // jitter never escapes the clamp
    for (const r of [0, 1, 0.2, 0.9]) {
      const g = spawnGap(40, () => r);
      expect(g).toBeGreaterThanOrEqual(SPAWN.minGap - 1e-9);
      expect(g).toBeLessThanOrEqual(SPAWN.startGap + 1e-9);
    }
  });

  test('patienceFor steps down 15 / 13 / 11 / 9 by phase, floored', () => {
    expect(patienceFor(0)).toBe(PATIENCE.base);
    expect(patienceFor(PHASES.RUSH)).toBe(PATIENCE.base - PATIENCE.perPhaseDrop);
    expect(patienceFor(PHASES.PEAK)).toBe(PATIENCE.base - 2 * PATIENCE.perPhaseDrop);
    expect(patienceFor(PHASES.CRUNCH)).toBe(PATIENCE.min);
    expect(patienceFor(1000)).toBeGreaterThanOrEqual(PATIENCE.min);
  });
});
