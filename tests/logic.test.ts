import { describe, expect, test } from 'vitest';
import { BOARD, CASH, COOK, FRYER_COOK, GRILL, PAN_COOK, PATIENCE, PAYOUT, PHASES, SHIFT, SPAWN, TABLE, UNLOCK } from '../src/game/constants.ts';
import {
  customerSlotRect,
  fryerSlotRect,
  grillSlotRect,
  panSlotRect,
  STATION_RECTS,
  tableSlotRect,
  type Rect,
} from '../src/game/geometry.ts';
import type { Station } from '../src/game/types.ts';
import {
  collectToken,
  cookFries,
  cookOnion,
  cookPatty,
  cookSausage,
  createState,
  dropCookedOnPlate,
  dropDrink,
  dropKetchup,
  dropMustard,
  generateOrder,
  gradeOf,
  isBurnt,
  patienceFor,
  phaseOf,
  placeBun,
  placeBurgerBun,
  plateMatchesOrder,
  platePayout,
  servePlate,
  spawnGap,
  startCooking,
  startFrying,
  startGame,
  startPan,
  step,
  tapGrill,
  tokenAt,
  trashItem,
  trashPlate,
} from '../src/game/logic.ts';
import type { GameState, Order, Plate } from '../src/game/types.ts';

function playing(): GameState {
  const s = createState();
  startGame(s);
  return s;
}
const order = (p: Partial<Order>): Order => ({
  sausage: false,
  burger: false,
  ketchup: false,
  mustard: false,
  drink: false,
  fries: false,
  onion: false,
  ...p,
});
function addCustomer(s: GameState, o: Partial<Order>, slot = 0): void {
  s.customers.push({ id: 99, slot, order: order(o), patience: 10, patienceMax: 10, served: false, leaving: false, appear: 1 });
}
const plate = (p: Partial<Plate>): Plate => ({
  bun: false,
  burgerBun: false,
  sausage: null,
  patty: null,
  fries: null,
  onion: false,
  ketchup: false,
  mustard: false,
  drink: false,
  ...p,
});

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
    expect(platePayout(plate({ bun: true, sausage: 'perfect' }), order({ sausage: true }), 0)).toBe(PAYOUT.bun + PAYOUT.perfect);
  });
  test('loaded dog + drink sums every item', () => {
    const pay = platePayout(plate({ bun: true, sausage: 'perfect', ketchup: true, drink: true }), order({ sausage: true, ketchup: true, drink: true }), 0);
    expect(pay).toBe(PAYOUT.bun + PAYOUT.perfect + PAYOUT.ketchup + PAYOUT.drink);
  });
  test('a perfect burger = burger bun + perfect patty', () => {
    expect(platePayout(plate({ burgerBun: true, patty: 'perfect' }), order({ burger: true }), 0)).toBe(PAYOUT.burgerBun + PAYOUT.perfect);
  });
  test('wanted-but-missing ketchup docks pay (still sells)', () => {
    expect(platePayout(plate({ bun: true, sausage: 'perfect' }), order({ sausage: true, ketchup: true }), 0)).toBe(PAYOUT.bun + PAYOUT.perfect - PAYOUT.ketchupMiss);
  });
  test('drink-only pays the drink value', () => {
    expect(platePayout(plate({ drink: true }), order({ drink: true }), 0)).toBe(PAYOUT.drink);
  });
});

describe('order matching (ketchup is a modifier, not a gate)', () => {
  test('completes on protein + drink presence, ignoring ketchup', () => {
    const o = order({ sausage: true, ketchup: true });
    expect(plateMatchesOrder(plate({ bun: true, sausage: 'good' }), o)).toBe(true);
    expect(plateMatchesOrder(plate({ bun: true, sausage: 'good', drink: true }), o)).toBe(false);
  });
  test('a sausage does not satisfy a burger order and vice-versa', () => {
    expect(plateMatchesOrder(plate({ bun: true, sausage: 'good' }), order({ burger: true }))).toBe(false);
    expect(plateMatchesOrder(plate({ burgerBun: true, patty: 'good' }), order({ burger: true }))).toBe(true);
  });
  test('generateOrder respects the burger unlock time', () => {
    // before unlock: never a burger, always a sausage
    for (let i = 0; i < 20; i++) {
      const o = generateOrder(() => i / 20, 0);
      expect(o.burger).toBe(false);
      expect(o.sausage).toBe(true);
    }
    // after unlock, a low rng selects a burger
    expect(generateOrder(() => 0, UNLOCK.burger).burger).toBe(true);
  });
});

describe('cook from the raw-ingredient sources (tap), not the grill', () => {
  test('tapping an empty grill slot does nothing; a cooked item says grab (drag it)', () => {
    const s = playing();
    expect(tapGrill(s, 0)).toBe('none'); // no auto-cook on the grill
    cookPatty(s);
    s.dogs[0].cook = 10;
    expect(tapGrill(s, s.dogs[0].slot)).toBe('grab');
  });
  test('clicking raw patties / sausages fills the patty (0..2) / sausage (3..5) positions', () => {
    const s = playing();
    expect(cookPatty(s)).toBe(0);
    expect(cookPatty(s)).toBe(1);
    expect(cookPatty(s)).toBe(2);
    expect(cookPatty(s)).toBe(-1); // patty positions full
    expect(cookSausage(s)).toBe(3);
    expect(cookSausage(s)).toBe(4);
    expect(cookSausage(s)).toBe(5);
    expect(cookSausage(s)).toBe(-1);
    expect(s.dogs.filter((d) => d.kind === 'patty')).toHaveLength(3);
    expect(s.dogs.filter((d) => d.kind === 'sausage')).toHaveLength(3);
  });
  test('clicking potatoes fills the fryer; clicking onions fills the pans', () => {
    const s = playing();
    expect(cookFries(s)).toBe(0);
    expect(cookFries(s)).toBe(-1); // single fryer slot
    expect(cookOnion(s)).toBe(0);
    expect(cookOnion(s)).toBe(1);
    expect(cookOnion(s)).toBe(-1); // two pans
  });
  test('tapping a burnt grill item tosses it', () => {
    const s = playing();
    cookOne(s, COOK.burntFrom + 1);
    expect(tapGrill(s, 0)).toBe('tossed');
    expect(s.dogs).toHaveLength(0);
  });
  test('Bun fills hot-dog lanes 0..2, then refuses', () => {
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
    expect(dropCookedOnPlate(s, id, slot)).toBe('ok');
    expect(s.plates[slot]?.sausage).toBe('perfect');
    expect(s.dogs).toHaveLength(0);
  });
  test('sausage needs a bun, and a bun holds only one', () => {
    const s = playing();
    const id = cookOne(s, 10);
    expect(dropCookedOnPlate(s, id, 0)).toBe('need-bun'); // empty slot
    const slot = placeBun(s);
    expect(dropCookedOnPlate(s, id, slot)).toBe('ok');
    const id2 = cookOne(s, 10);
    expect(dropCookedOnPlate(s, id2, slot)).toBe('busy');
  });
  test('a burnt sausage cannot be plated', () => {
    const s = playing();
    const slot = placeBun(s);
    const id = cookOne(s, COOK.burntFrom + 1);
    expect(dropCookedOnPlate(s, id, slot)).toBe('bad');
  });
  test('drag ketchup onto a dog; drag a drink onto a plate or empty slot', () => {
    const s = playing();
    const slot = placeBun(s);
    const id = cookOne(s, 10);
    dropCookedOnPlate(s, id, slot);
    expect(dropKetchup(s, slot)).toBe(true);
    expect(s.plates[slot]?.ketchup).toBe(true);
    expect(dropDrink(s, slot)).toBe(true);
    expect(dropDrink(s, 2)).toBe(true); // empty slot -> drink-only plate
    expect(s.plates[2]).toEqual(plate({ drink: true }));
  });

  test('burgers end to end: cook a patty, bun it, serve a burger order', () => {
    const s = playing();
    addCustomer(s, { burger: true });
    const slot = placeBurgerBun(s);
    expect(slot).toBe(3); // burger lanes are slots 3..5
    startCooking(s, 0, 'patty');
    s.dogs[0].cook = 10; // perfect
    expect(s.dogs[0].kind).toBe('patty');
    expect(dropCookedOnPlate(s, s.dogs[0].id, slot)).toBe('ok');
    expect(s.plates[slot]?.patty).toBe('perfect');
    const res = servePlate(s, slot, 0);
    expect(res.ok).toBe(true);
    // addCustomer seeds full patience, so the speed tip applies via servePlate.
    expect(res.payout).toBe(PAYOUT.burgerBun + PAYOUT.perfect + PAYOUT.speedBonusMax);
  });

  test('a patty needs a burger bun, not a hot-dog bun', () => {
    const s = playing();
    placeBun(s); // hot-dog bun in slot 0
    startCooking(s, 0, 'patty');
    s.dogs[0].cook = 10;
    expect(dropCookedOnPlate(s, s.dogs[0].id, 0)).toBe('need-bun');
  });
});

describe('trash', () => {
  test('trash a sausage and trash a plate', () => {
    const s = playing();
    s.combo = 4;
    const id = cookOne(s, 10);
    expect(trashItem(s, id)).toBe(true);
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
    dropCookedOnPlate(s, id, slot);
  }

  test('drag a matching plate to a customer: serves, spawns a token, defers cash', () => {
    const s = playing();
    addCustomer(s, { sausage: true, ketchup: false, drink: false });
    const slot = placeBun(s);
    buildDog(s, slot);
    const res = servePlate(s, slot, 0);
    expect(res.ok).toBe(true);
    expect(res.payout).toBe(PAYOUT.bun + PAYOUT.perfect + PAYOUT.speedBonusMax);
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
    expect(res.payout).toBe(PAYOUT.bun + PAYOUT.perfect - PAYOUT.ketchupMiss + PAYOUT.speedBonusMax);
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
    expect(collectToken(s, tok.id)).toBe(PAYOUT.drink + PAYOUT.speedBonusMax);
    expect(s.cash).toBe(PAYOUT.drink + PAYOUT.speedBonusMax);
    expect(s.pending).toBe(0);
  });
});

describe('fries (fryer) + onions (pan)', () => {
  test('fries cook on the fryer band and can start their own plate', () => {
    const s = playing();
    expect(startFrying(s, 0)).toBe(true);
    expect(s.dogs[0].kind).toBe('fries');
    expect(s.dogs[0].station).toBe('fryer');
    s.dogs[0].cook = FRYER_COOK.perfectFrom + 0.5; // perfect on the fryer band
    expect(dropCookedOnPlate(s, s.dogs[0].id, 0)).toBe('ok'); // empty slot -> fries plate
    expect(s.plates[0]?.fries).toBe('perfect');
  });

  test('an onion needs a protein on the plate', () => {
    const s = playing();
    startPan(s, 0);
    s.dogs[0].cook = PAN_COOK.perfectFrom + 0.5;
    expect(dropCookedOnPlate(s, s.dogs[0].id, 0)).toBe('bad'); // no plate/protein
    placeBun(s); // bun in slot 0, still no sausage
    expect(dropCookedOnPlate(s, s.dogs[0].id, 0)).toBe('bad');
  });

  test('grill and fryer slots with the same index do not collide', () => {
    const s = playing();
    startCooking(s, 0, 'sausage'); // grill slot 0
    startFrying(s, 0); // fryer slot 0
    expect(s.dogs.filter((d) => d.slot === 0)).toHaveLength(2);
    expect(s.dogs.find((d) => d.station === 'grill')?.kind).toBe('sausage');
    expect(s.dogs.find((d) => d.station === 'fryer')?.kind).toBe('fries');
  });

  test('fries payout + matching; onion is a pay modifier', () => {
    expect(platePayout(plate({ fries: 'perfect' }), order({ fries: true }), 0)).toBe(PAYOUT.friesPerfect);
    expect(plateMatchesOrder(plate({ fries: 'good' }), order({ fries: true }))).toBe(true);
    expect(plateMatchesOrder(plate({ bun: true, sausage: 'good' }), order({ sausage: true, fries: true }))).toBe(false);
    const withOnion = platePayout(plate({ bun: true, sausage: 'perfect', onion: true }), order({ sausage: true, onion: true }), 0);
    expect(withOnion).toBe(PAYOUT.bun + PAYOUT.perfect + PAYOUT.onion);
  });

  test('fries only appear in orders after their unlock time', () => {
    for (let i = 0; i < 20; i++) expect(generateOrder(() => i / 20, UNLOCK.fries - 1).fries).toBe(false);
    expect(generateOrder(() => 0, UNLOCK.fries).fries).toBe(true);
  });
});

describe('mustard (second condiment)', () => {
  test('mustard needs a protein and modifies pay like ketchup', () => {
    const s = playing();
    placeBun(s);
    expect(dropMustard(s, 0)).toBe(false); // bun only, no protein
    startCooking(s, 0, 'sausage');
    s.dogs[0].cook = 10;
    dropCookedOnPlate(s, s.dogs[0].id, 0);
    expect(dropMustard(s, 0)).toBe(true);
    expect(s.plates[0]?.mustard).toBe(true);
    expect(dropMustard(s, 0)).toBe(false); // already mustarded
  });
  test('payout: +mustard when present, -mustardMiss when wanted but missing', () => {
    const withM = platePayout(plate({ bun: true, sausage: 'perfect', mustard: true }), order({ sausage: true, mustard: true }), 0);
    expect(withM).toBe(PAYOUT.bun + PAYOUT.perfect + PAYOUT.mustard);
    const without = platePayout(plate({ bun: true, sausage: 'perfect' }), order({ sausage: true, mustard: true }), 0);
    expect(without).toBe(PAYOUT.bun + PAYOUT.perfect - PAYOUT.mustardMiss);
  });
  test('mustard only appears in orders after its unlock time', () => {
    for (let i = 0; i < 20; i++) expect(generateOrder(() => i / 20, UNLOCK.mustard - 1).mustard).toBe(false);
    expect(generateOrder(() => 0, UNLOCK.mustard).mustard).toBe(true);
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
    expect(s.cash).toBe(PAYOUT.drink + PAYOUT.speedBonusMax);
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

describe('speed-based tips', () => {
  const p = plate({ bun: true, sausage: 'perfect' });
  const o = order({ sausage: true });
  const base = PAYOUT.bun + PAYOUT.perfect;

  test('full patience adds speedBonusMax', () => {
    expect(platePayout(p, o, 0, 1)).toBe(base + PAYOUT.speedBonusMax);
  });
  test('scales linearly and rounds (0.5 -> 3)', () => {
    expect(platePayout(p, o, 0, 0.5)).toBe(base + Math.round(PAYOUT.speedBonusMax * 0.5));
  });
  test('zero at no patience, clamps negatives and over-1', () => {
    expect(platePayout(p, o, 0, 0)).toBe(base);
    expect(platePayout(p, o, 0, -1)).toBe(base);
    expect(platePayout(p, o, 0, 2)).toBe(base + PAYOUT.speedBonusMax);
  });
  test('back-compat: 3-arg call adds NO speed bonus', () => {
    expect(platePayout(p, o, 0)).toBe(base);
  });
  test('servePlate passes through the patience fraction', () => {
    const s1 = playing();
    addCustomer(s1, { sausage: true });
    s1.customers[0].patience = s1.customers[0].patienceMax; // full
    const slot1 = placeBun(s1);
    dropCookedOnPlate(s1, cookOne(s1, 10), slot1);
    expect(servePlate(s1, slot1, 0).payout).toBe(base + PAYOUT.speedBonusMax);

    const s2 = playing();
    addCustomer(s2, { sausage: true });
    s2.customers[0].patience = s2.customers[0].patienceMax / 2; // half
    const slot2 = placeBun(s2);
    dropCookedOnPlate(s2, cookOne(s2, 10), slot2);
    expect(servePlate(s2, slot2, 0).payout).toBe(base + Math.round(PAYOUT.speedBonusMax * 0.5));
  });
});

describe('combo curve buff', () => {
  test('new combo constants', () => {
    expect(PAYOUT.comboStep).toBe(2);
    expect(PAYOUT.comboMax).toBe(10);
  });
  test('payout reflects the new curve and caps at comboMax', () => {
    const p = plate({ bun: true, sausage: 'perfect' });
    const o = order({ sausage: true });
    const base = PAYOUT.bun + PAYOUT.perfect;
    expect(platePayout(p, o, 10)).toBe(base + 10 * PAYOUT.comboStep);
    expect(platePayout(p, o, 15)).toBe(base + PAYOUT.comboMax * PAYOUT.comboStep);
  });
});

describe('combo-meal bonus', () => {
  test('protein + fries + drink wanted and delivered adds comboMealBonus', () => {
    const pay = platePayout(
      plate({ bun: true, sausage: 'perfect', fries: 'perfect', drink: true }),
      order({ sausage: true, fries: true, drink: true }),
      0,
    );
    expect(pay).toBe(PAYOUT.bun + PAYOUT.perfect + PAYOUT.friesPerfect + PAYOUT.drink + PAYOUT.comboMealBonus);
  });
  test('not applied when fries missing from the order', () => {
    const pay = platePayout(plate({ bun: true, sausage: 'perfect', drink: true }), order({ sausage: true, drink: true }), 0);
    expect(pay).toBe(PAYOUT.bun + PAYOUT.perfect + PAYOUT.drink);
  });
  test('works for burger protein too', () => {
    const pay = platePayout(
      plate({ burgerBun: true, patty: 'perfect', fries: 'perfect', drink: true }),
      order({ burger: true, fries: true, drink: true }),
      0,
    );
    expect(pay).toBe(PAYOUT.burgerBun + PAYOUT.perfect + PAYOUT.friesPerfect + PAYOUT.drink + PAYOUT.comboMealBonus);
  });
});

describe('richer orders in PEAK/CRUNCH', () => {
  test('PEAK raises the drink probability vs WARMUP', () => {
    expect(generateOrder(() => 0.6, PHASES.PEAK).drink).toBe(true); // 0.6 < 0.65
    expect(generateOrder(() => 0.6, 0).drink).toBe(false); // 0.6 >= 0.4 (WARMUP unchanged)
  });
  test('regression: WARMUP fries/drink booleans unchanged at rng 0.5', () => {
    const o = generateOrder(() => 0.5, 0);
    expect(o.drink).toBe(false); // 0.5 >= 0.4
    expect(o.fries).toBe(false); // gated by unlock at elapsed 0
  });
});

describe('baked calibration layout', () => {
  const inBounds = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= BOARD.width && r.y + r.h <= BOARD.height;

  test('board is 960x640 (3:2)', () => {
    expect(BOARD.width).toBe(960);
    expect(BOARD.height).toBe(640);
  });

  test('grill has 6 slots (3 patty + 3 sausage), table has 6 lanes (3 dog + 3 burger)', () => {
    expect(GRILL.slots).toBe(6);
    expect(TABLE.slots).toBe(6);
    expect(TABLE.dogLanes + TABLE.burgerLanes).toBe(TABLE.slots);
  });

  test('hot-dog buns fill lanes 0..2; burger buns fill lanes 3..5', () => {
    const s = playing();
    expect(placeBun(s)).toBe(0);
    expect(placeBun(s)).toBe(1);
    expect(placeBun(s)).toBe(2);
    expect(placeBun(s)).toBe(-1); // dog lanes full
    expect(placeBurgerBun(s)).toBe(3);
    expect(placeBurgerBun(s)).toBe(4);
    expect(placeBurgerBun(s)).toBe(5);
    expect(placeBurgerBun(s)).toBe(-1); // burger lanes full
  });

  test('every calibrated zone rect sits inside the board', () => {
    for (let i = 0; i < GRILL.slots; i++) expect(inBounds(grillSlotRect(i))).toBe(true);
    for (let i = 0; i < TABLE.slots; i++) expect(inBounds(tableSlotRect(i))).toBe(true);
    expect(inBounds(fryerSlotRect(0))).toBe(true);
    expect(inBounds(panSlotRect(0))).toBe(true);
    expect(inBounds(panSlotRect(1))).toBe(true);
    for (let i = 0; i < CUSTOMER_MAX; i++) expect(inBounds(customerSlotRect(i))).toBe(true);
    for (const st of Object.keys(STATION_RECTS) as Station[]) expect(inBounds(STATION_RECTS[st])).toBe(true);
  });
});
const CUSTOMER_MAX = 5;
