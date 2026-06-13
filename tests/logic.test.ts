import { describe, expect, test } from 'vitest';
import { COOK, PAYOUT, RULES } from '../src/game/constants.ts';
import {
  createState,
  gradeOf,
  payoutFor,
  serveFromSlot,
  spawnInterval,
  startCooking,
  startGame,
  step,
} from '../src/game/logic.ts';

describe('gradeOf', () => {
  test('undercooked is rejected', () => {
    expect(gradeOf(COOK.rawUntil - 0.01)).toBe('reject');
  });
  test('green zone is perfect', () => {
    expect(gradeOf((COOK.perfectFrom + COOK.perfectTo) / 2)).toBe('perfect');
  });
  test('slightly past perfect is good', () => {
    expect(gradeOf((COOK.perfectTo + COOK.goodTo) / 2)).toBe('good');
  });
  test('burnt is rejected', () => {
    expect(gradeOf(COOK.burntAt + 0.05)).toBe('reject');
  });
});

describe('payoutFor', () => {
  test('reject pays nothing regardless of combo', () => {
    expect(payoutFor('reject', 10)).toBe(0);
  });
  test('perfect pays base plus combo bonus, capped', () => {
    expect(payoutFor('perfect', 0)).toBe(PAYOUT.perfect);
    expect(payoutFor('perfect', 3)).toBe(PAYOUT.perfect + 3 * PAYOUT.comboStep);
    expect(payoutFor('perfect', 999)).toBe(PAYOUT.perfect + PAYOUT.comboMax * PAYOUT.comboStep);
  });
});

describe('spawnInterval', () => {
  test('starts slow and ramps down to the floor', () => {
    expect(spawnInterval(0)).toBeCloseTo(RULES.spawnStart);
    expect(spawnInterval(10_000)).toBe(RULES.spawnMin);
  });
});

describe('startCooking', () => {
  test('places a dog on an empty slot while playing', () => {
    const s = createState();
    startGame(s);
    expect(startCooking(s, 0)).toBe(true);
    expect(s.dogs).toHaveLength(1);
  });
  test('refuses an occupied slot', () => {
    const s = createState();
    startGame(s);
    startCooking(s, 0);
    expect(startCooking(s, 0)).toBe(false);
    expect(s.dogs).toHaveLength(1);
  });
  test('refuses when not playing', () => {
    const s = createState(); // phase 'start'
    expect(startCooking(s, 0)).toBe(false);
  });
});

describe('serveFromSlot', () => {
  test('serving a perfect dog to a waiting customer pays and increments combo', () => {
    const s = createState();
    startGame(s);
    startCooking(s, 0);
    s.dogs[0].cook = (COOK.perfectFrom + COOK.perfectTo) / 2; // perfect
    s.customers.push({ id: 1, slot: 0, patience: 5, patienceMax: 5, served: false, leaving: false });

    const res = serveFromSlot(s, 0);
    expect(res?.grade).toBe('perfect');
    expect(s.cash).toBe(PAYOUT.perfect);
    expect(s.served).toBe(1);
    expect(s.combo).toBe(1);
    expect(s.dogs).toHaveLength(0);
  });

  test('serving an undercooked dog wastes it and breaks combo', () => {
    const s = createState();
    startGame(s);
    s.combo = 4;
    startCooking(s, 1);
    s.dogs[0].cook = 0.01; // raw
    s.customers.push({ id: 1, slot: 0, patience: 5, patienceMax: 5, served: false, leaving: false });

    const res = serveFromSlot(s, 1);
    expect(res?.grade).toBe('reject');
    expect(s.cash).toBe(0);
    expect(s.combo).toBe(0);
    expect(s.dogs).toHaveLength(0);
  });

  test('tossing a burnt dog clears the slot with no customer needed', () => {
    const s = createState();
    startGame(s);
    startCooking(s, 2);
    s.dogs[0].state = 'burnt';
    const res = serveFromSlot(s, 2);
    expect(res?.grade).toBe('reject');
    expect(s.dogs).toHaveLength(0);
  });

  test('does nothing if no customer is waiting for a good dog', () => {
    const s = createState();
    startGame(s);
    startCooking(s, 0);
    s.dogs[0].cook = (COOK.perfectFrom + COOK.perfectTo) / 2;
    const res = serveFromSlot(s, 0);
    expect(res).toBeNull();
    expect(s.dogs).toHaveLength(1); // dog stays on the grill
  });
});

describe('step', () => {
  test('cooks dogs over time and burns them past the threshold', () => {
    const s = createState();
    startGame(s);
    startCooking(s, 0);
    step(s, COOK.fullTime * COOK.burntAt + 0.1);
    expect(s.dogs[0].state).toBe('burnt');
  });

  test('a customer whose patience expires costs a life and breaks combo', () => {
    const s = createState();
    startGame(s);
    s.combo = 3;
    s.customers.push({ id: 1, slot: 0, patience: 0.5, patienceMax: 5, served: false, leaving: false });
    const before = s.lives;
    const { lostLife } = step(s, 1);
    expect(lostLife).toBe(true);
    expect(s.lives).toBe(before - 1);
    expect(s.combo).toBe(0);
  });

  test('game ends when lives reach zero', () => {
    const s = createState();
    startGame(s);
    s.lives = 1;
    s.customers.push({ id: 1, slot: 0, patience: 0.1, patienceMax: 5, served: false, leaving: false });
    step(s, 1);
    expect(s.phase).toBe('gameover');
  });
});
