import { describe, expect, test } from 'vitest';
import { CASH, COOK, ORDER_COMBOS, PAYOUT, RULES, SHIFT } from '../src/game/constants.ts';
import {
  collectToken,
  createState,
  generateOrder,
  gradeOf,
  isBurnt,
  plateMatchesOrder,
  platePayout,
  selectPlate,
  serveCustomer,
  startCooking,
  startGame,
  step,
  tapGrill,
  tokenAt,
  useStation,
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
    const o: Order = { sausage: false, ketchup: false, drink: true };
    expect(platePayout(plate({ drink: true }), o, 0)).toBe(PAYOUT.drink);
  });
});

describe('order matching (ketchup is a modifier, not a gate)', () => {
  test('completes on sausage + drink presence, ignoring ketchup', () => {
    const o: Order = { sausage: true, ketchup: true, drink: false };
    expect(plateMatchesOrder(plate({ bun: true, sausage: 'good' }), o)).toBe(true); // missing ketchup still matches
    expect(plateMatchesOrder(plate({ bun: true, sausage: 'good', drink: true }), o)).toBe(false); // unwanted drink
  });
  test('generateOrder yields canonical combos', () => {
    for (let i = 0; i < ORDER_COMBOS.length; i++) {
      expect(ORDER_COMBOS).toContainEqual(generateOrder(() => i / ORDER_COMBOS.length));
    }
  });
});

describe('multi-plate prep table', () => {
  test('Bun fills the next empty slot and makes it active', () => {
    const s = playing();
    expect(useStation(s, 'bun')).toBe('ok');
    expect(s.activePlate).toBe(0);
    expect(useStation(s, 'bun')).toBe('ok');
    expect(s.activePlate).toBe(1);
    expect(s.plates.filter(Boolean)).toHaveLength(2);
  });
  test('tapping a table plate selects it as active', () => {
    const s = playing();
    useStation(s, 'bun'); // slot 0
    useStation(s, 'bun'); // slot 1 active
    expect(selectPlate(s, 0)).toBe('selected');
    expect(s.activePlate).toBe(0);
  });
  test('cooked sausage goes onto the ACTIVE bun', () => {
    const s = playing();
    useStation(s, 'bun');
    startCooking(s, 0);
    s.dogs[0].cook = 10;
    expect(tapGrill(s, 0)).toBe('plated');
    expect(s.plates[0]?.sausage).toBe('perfect');
  });
  test('cannot plate a sausage with no active bun', () => {
    const s = playing();
    startCooking(s, 0);
    s.dogs[0].cook = 10;
    expect(tapGrill(s, 0)).toBe('need-bun');
  });
  test('table caps at its slot count', () => {
    const s = playing();
    useStation(s, 'bun');
    useStation(s, 'bun');
    useStation(s, 'bun');
    expect(useStation(s, 'bun')).toBe('noop'); // full
  });
});

describe('trash', () => {
  test('burnt grill dog can be tossed by tapping it', () => {
    const s = playing();
    startCooking(s, 1);
    s.dogs[0].cook = COOK.burntFrom + 1;
    expect(tapGrill(s, 1)).toBe('tossed');
    expect(s.dogs).toHaveLength(0);
  });
  test('trash station bins the active plate and breaks combo', () => {
    const s = playing();
    s.combo = 4;
    useStation(s, 'bun');
    expect(useStation(s, 'trash')).toBe('ok');
    expect(s.plates[0]).toBeNull();
    expect(s.activePlate).toBe(-1);
    expect(s.combo).toBe(0);
  });
  test('trash station scrapes a burnt dog when no active plate', () => {
    const s = playing();
    startCooking(s, 2);
    s.dogs[0].cook = COOK.burntFrom + 2;
    expect(useStation(s, 'trash')).toBe('ok');
    expect(s.dogs).toHaveLength(0);
  });
});

describe('serving + cash collection', () => {
  test('a matching order serves, spawns a token, defers the cash', () => {
    const s = playing();
    addCustomer(s, { sausage: true, ketchup: false, drink: false });
    useStation(s, 'bun');
    startCooking(s, 0);
    s.dogs[0].cook = 10;
    tapGrill(s, 0);
    const res = serveCustomer(s, 0);
    expect(res.ok).toBe(true);
    expect(res.payout).toBe(PAYOUT.bun + PAYOUT.perfect);
    expect(s.cashTokens).toHaveLength(1);
    expect(s.cash).toBe(0);
    expect(s.pending).toBe(res.payout);
    expect(s.plates[0]).toBeNull();
  });
  test('missing wanted ketchup still serves, for less', () => {
    const s = playing();
    addCustomer(s, { sausage: true, ketchup: true, drink: false });
    useStation(s, 'bun');
    startCooking(s, 0);
    s.dogs[0].cook = 10;
    tapGrill(s, 0); // no ketchup added
    const res = serveCustomer(s, 0);
    expect(res.ok).toBe(true);
    expect(res.payout).toBe(PAYOUT.bun + PAYOUT.perfect - PAYOUT.ketchupMiss);
  });
  test('wrong sausage/drink presence is rejected and breaks combo', () => {
    const s = playing();
    s.combo = 3;
    addCustomer(s, { sausage: true, ketchup: false, drink: false });
    useStation(s, 'bun');
    useStation(s, 'drink'); // adds an unwanted drink to the same plate
    startCooking(s, 0);
    s.dogs[0].cook = 10;
    tapGrill(s, 0);
    const res = serveCustomer(s, 0);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('wrong-order');
    expect(s.combo).toBe(0);
    expect(s.wrong).toBe(1);
  });
  test('collecting the token moves pending into cash', () => {
    const s = playing();
    addCustomer(s, { sausage: false, ketchup: false, drink: true });
    useStation(s, 'drink');
    serveCustomer(s, 0);
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
  test('patience is the original 15 seconds; running out is a miss', () => {
    expect(RULES.patience).toBe(15);
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
    useStation(s, 'drink');
    serveCustomer(s, 0);
    s.timeLeft = 0.5;
    step(s, 1, () => 0);
    expect(s.timeLeft).toBe(0);
    expect(s.phase).toBe('gameover');
    expect(s.cash).toBe(PAYOUT.drink);
  });
  test('uncollected cash expires before the buzzer', () => {
    const s = playing();
    addCustomer(s, { sausage: false, ketchup: false, drink: true });
    useStation(s, 'drink');
    serveCustomer(s, 0);
    step(s, CASH.life + 0.1, () => 0);
    expect(s.cashTokens).toHaveLength(0);
    expect(s.pending).toBe(0);
    expect(s.cash).toBe(0);
  });
  test('customers spawn on the 8s cadence and animate in', () => {
    const s = playing();
    s.spawnTimer = RULES.spawnInterval;
    step(s, RULES.spawnInterval + 0.1, () => 0);
    expect(s.customers.length).toBeGreaterThanOrEqual(1);
    expect(s.customers[0].appear).toBe(0); // spawned this tick
    step(s, 0.1, () => 0); // animates in on the next tick
    expect(s.customers[0].appear).toBeGreaterThan(0);
  });
  test('shift is 90 seconds', () => {
    expect(SHIFT.duration).toBe(90);
    expect(createState().timeLeft).toBe(90);
  });
});
