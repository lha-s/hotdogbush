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
  serveCustomer,
  startCooking,
  startGame,
  step,
  tapGrill,
  tokenAt,
  useStation,
} from '../src/game/logic.ts';
import type { GameState, Order } from '../src/game/types.ts';

function playing(): GameState {
  const s = createState();
  startGame(s);
  return s;
}

function addCustomer(s: GameState, order: Order, slot = 0): void {
  s.customers.push({ id: 99, slot, order, patience: 10, patienceMax: 10, served: false, leaving: false });
}

describe('cooking grades & burn', () => {
  test('doneness bands follow the original 7s / 14s steps', () => {
    expect(gradeOf(0)).toBe('good');
    expect(gradeOf(COOK.perfectFrom)).toBe('perfect');
    expect(gradeOf(COOK.overdoneFrom)).toBe('overdone');
  });
  test('a dog is burnt only past the burnt threshold', () => {
    expect(isBurnt(COOK.burntFrom - 0.1)).toBe(false);
    expect(isBurnt(COOK.burntFrom)).toBe(true);
  });
});

describe('platePayout', () => {
  test('sums sausage + ketchup + drink + combo bonus', () => {
    const pay = platePayout({ bun: true, sausage: 'perfect', ketchup: true, drink: true }, 0);
    expect(pay).toBe(PAYOUT.perfect + PAYOUT.ketchup + PAYOUT.drink);
  });
  test('drink-only pays just the drink', () => {
    expect(platePayout({ bun: false, sausage: null, ketchup: false, drink: true }, 0)).toBe(PAYOUT.drink);
  });
  test('combo bonus is capped', () => {
    const a = platePayout({ bun: true, sausage: 'good', ketchup: false, drink: false }, 999);
    expect(a).toBe(PAYOUT.good + PAYOUT.comboMax * PAYOUT.comboStep);
  });
});

describe('orders', () => {
  test('generateOrder returns one of the five canonical combos', () => {
    for (let i = 0; i < ORDER_COMBOS.length; i++) {
      const o = generateOrder(() => i / ORDER_COMBOS.length);
      expect(ORDER_COMBOS).toContainEqual(o);
    }
  });
  test('plateMatchesOrder compares sausage presence, ketchup, drink', () => {
    const order: Order = { sausage: true, ketchup: true, drink: false };
    expect(plateMatchesOrder({ bun: true, sausage: 'perfect', ketchup: true, drink: false }, order)).toBe(true);
    expect(plateMatchesOrder({ bun: true, sausage: 'perfect', ketchup: false, drink: false }, order)).toBe(false);
    expect(plateMatchesOrder({ bun: false, sausage: null, ketchup: false, drink: true }, order)).toBe(false);
  });
});

describe('assembly via stations + grill', () => {
  test('bun → cook → plate sausage → ketchup builds a dog', () => {
    const s = playing();
    expect(useStation(s, 'bun')).toBe('ok');
    expect(s.plate?.bun).toBe(true);

    startCooking(s, 0);
    s.dogs[0].cook = 10; // perfect
    expect(tapGrill(s, 0)).toBe('plated');
    expect(s.plate?.sausage).toBe('perfect');
    expect(s.dogs).toHaveLength(0);

    expect(useStation(s, 'ketchup')).toBe('ok');
    expect(s.plate?.ketchup).toBe(true);
  });

  test('cannot plate a sausage without a bun first', () => {
    const s = playing();
    startCooking(s, 0);
    s.dogs[0].cook = 10;
    expect(tapGrill(s, 0)).toBe('need-bun');
    expect(s.dogs).toHaveLength(1); // sausage stays on the grill
  });

  test('ketchup needs a sausage on the plate', () => {
    const s = playing();
    useStation(s, 'bun');
    expect(useStation(s, 'ketchup')).toBe('noop');
  });

  test('drink can start a plate on its own (drink-only order)', () => {
    const s = playing();
    expect(useStation(s, 'drink')).toBe('ok');
    expect(s.plate).toEqual({ bun: false, sausage: null, ketchup: false, drink: true });
  });
});

describe('trash', () => {
  test('tapping a burnt grill dog tosses it', () => {
    const s = playing();
    startCooking(s, 1);
    s.dogs[0].cook = COOK.burntFrom + 1;
    expect(tapGrill(s, 1)).toBe('tossed');
    expect(s.dogs).toHaveLength(0);
  });

  test('trash station bins the current plate and breaks combo', () => {
    const s = playing();
    s.combo = 4;
    useStation(s, 'bun');
    expect(useStation(s, 'trash')).toBe('ok');
    expect(s.plate).toBeNull();
    expect(s.combo).toBe(0);
  });

  test('trash station scrapes a burnt dog when the plate is empty', () => {
    const s = playing();
    startCooking(s, 2);
    s.dogs[0].cook = COOK.burntFrom + 2;
    expect(useStation(s, 'trash')).toBe('ok');
    expect(s.dogs).toHaveLength(0);
  });
});

describe('serving + cash collection', () => {
  test('matching order serves, spawns a cash token, does not yet add cash', () => {
    const s = playing();
    addCustomer(s, { sausage: true, ketchup: false, drink: false });
    useStation(s, 'bun');
    startCooking(s, 0);
    s.dogs[0].cook = 10;
    tapGrill(s, 0);

    const res = serveCustomer(s, 0);
    expect(res.ok).toBe(true);
    expect(res.payout).toBe(PAYOUT.perfect);
    expect(s.served).toBe(1);
    expect(s.plate).toBeNull();
    expect(s.cashTokens).toHaveLength(1);
    expect(s.cash).toBe(0); // not collected yet
    expect(s.pending).toBe(PAYOUT.perfect);
  });

  test('collecting the token moves pending into cash', () => {
    const s = playing();
    addCustomer(s, { sausage: false, ketchup: false, drink: true });
    useStation(s, 'drink');
    serveCustomer(s, 0);
    const tok = s.cashTokens[0];
    const got = tokenAt(s, tok.x, tok.y);
    expect(got?.id).toBe(tok.id);
    const amount = collectToken(s, tok.id);
    expect(amount).toBe(PAYOUT.drink);
    expect(s.cash).toBe(PAYOUT.drink);
    expect(s.pending).toBe(0);
    expect(s.cashTokens).toHaveLength(0);
  });

  test('wrong order is wasted, breaks combo, customer stays', () => {
    const s = playing();
    s.combo = 3;
    addCustomer(s, { sausage: true, ketchup: true, drink: false });
    useStation(s, 'bun');
    startCooking(s, 0);
    s.dogs[0].cook = 10;
    tapGrill(s, 0); // dog but no ketchup -> mismatch
    const res = serveCustomer(s, 0);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('wrong-order');
    expect(s.plate).toBeNull();
    expect(s.combo).toBe(0);
    expect(s.wrong).toBe(1);
    expect(s.customers.some((c) => c.slot === 0 && !c.served)).toBe(true);
  });

  test('serving with nothing assembled does nothing', () => {
    const s = playing();
    addCustomer(s, { sausage: true, ketchup: false, drink: false });
    expect(serveCustomer(s, 0).reason).toBe('empty-plate');
  });
});

describe('step / shift', () => {
  test('cooking accrues in real seconds', () => {
    const s = playing();
    startCooking(s, 0);
    step(s, 8, () => 0);
    expect(s.dogs[0].cook).toBeCloseTo(8);
  });

  test('uncollected cash tokens expire and the pending pot shrinks', () => {
    const s = playing();
    addCustomer(s, { sausage: false, ketchup: false, drink: true });
    useStation(s, 'drink');
    serveCustomer(s, 0);
    expect(s.pending).toBe(PAYOUT.drink);
    step(s, CASH.life + 0.1, () => 0);
    expect(s.cashTokens).toHaveLength(0);
    expect(s.pending).toBe(0);
    expect(s.cash).toBe(0); // lost — never collected
  });

  test('a customer who runs out of patience is missed and breaks combo', () => {
    const s = playing();
    s.combo = 4;
    s.customers.push({
      id: 1,
      slot: 0,
      order: { sausage: true, ketchup: false, drink: false },
      patience: 0.5,
      patienceMax: 10,
      served: false,
      leaving: false,
    });
    const { missed } = step(s, 1, () => 0);
    expect(missed).toBe(true);
    expect(s.missed).toBe(1);
    expect(s.combo).toBe(0);
  });

  test('customers spawn on the constant 8s cadence', () => {
    const s = playing();
    s.spawnTimer = RULES.spawnInterval;
    step(s, RULES.spawnInterval + 0.1, () => 0);
    expect(s.customers.length).toBeGreaterThanOrEqual(1);
  });

  test('the clock counts down across the shift and ends the game', () => {
    const s = playing();
    expect(s.timeLeft).toBe(SHIFT.duration);
    step(s, SHIFT.duration + 1, () => 0);
    expect(s.timeLeft).toBe(0);
    expect(s.phase).toBe('gameover');
  });

  test('cash still on the counter at the buzzer is swept into the score', () => {
    const s = playing();
    addCustomer(s, { sausage: false, ketchup: false, drink: true });
    useStation(s, 'drink');
    serveCustomer(s, 0); // pending = drink value, uncollected, token still fresh
    s.timeLeft = 0.5; // about to end
    step(s, 1, () => 0); // token survives (life 3.5 - 1 > 0) and gets swept at the buzzer
    expect(s.phase).toBe('gameover');
    expect(s.cash).toBe(PAYOUT.drink);
    expect(s.pending).toBe(0);
  });
});
