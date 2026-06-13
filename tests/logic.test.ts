import { describe, expect, test } from 'vitest';
import { COOK, PAYOUT, RULES, SHIFT } from '../src/game/constants.ts';
import {
  createState,
  gradeOf,
  payoutFor,
  serveFromSlot,
  startCooking,
  startGame,
  step,
} from '../src/game/logic.ts';
import type { Customer } from '../src/game/types.ts';

const waitingCustomer = (slot = 0): Customer => ({
  id: 1,
  slot,
  patience: 5,
  patienceMax: 5,
  served: false,
  leaving: false,
});

describe('gradeOf (seconds-based, matches original 7s/14s steps)', () => {
  test('under 7s is underdone ("good")', () => {
    expect(gradeOf(0)).toBe('good');
    expect(gradeOf(COOK.perfectFrom - 0.1)).toBe('good');
  });
  test('7–14s is perfect', () => {
    expect(gradeOf(COOK.perfectFrom)).toBe('perfect');
    expect(gradeOf(COOK.overdoneFrom - 0.1)).toBe('perfect');
  });
  test('14s+ is overdone', () => {
    expect(gradeOf(COOK.overdoneFrom)).toBe('overdone');
    expect(gradeOf(60)).toBe('overdone');
  });
});

describe('payoutFor (every serve pays; original values 6 / 10 / 5)', () => {
  test('base values match the original sausage worth', () => {
    expect(payoutFor('good', 0)).toBe(PAYOUT.good); // 6
    expect(payoutFor('perfect', 0)).toBe(PAYOUT.perfect); // 10
    expect(payoutFor('overdone', 0)).toBe(PAYOUT.overdone); // 5
  });
  test('combo adds a capped bonus', () => {
    expect(payoutFor('perfect', 3)).toBe(PAYOUT.perfect + 3 * PAYOUT.comboStep);
    expect(payoutFor('perfect', 999)).toBe(PAYOUT.perfect + PAYOUT.comboMax * PAYOUT.comboStep);
  });
});

describe('startCooking', () => {
  test('places a dog with zero cook time while playing', () => {
    const s = createState();
    startGame(s);
    expect(startCooking(s, 0)).toBe(true);
    expect(s.dogs[0].cook).toBe(0);
  });
  test('refuses an occupied slot and refuses when not playing', () => {
    const s = createState();
    startGame(s);
    startCooking(s, 0);
    expect(startCooking(s, 0)).toBe(false);
    const fresh = createState();
    expect(startCooking(fresh, 0)).toBe(false);
  });
});

describe('serveFromSlot (no failure state — always sells)', () => {
  test('perfect dog to a waiting customer pays 10 and bumps combo', () => {
    const s = createState();
    startGame(s);
    startCooking(s, 0);
    s.dogs[0].cook = 10; // perfect (7–14s)
    s.customers.push(waitingCustomer());
    const res = serveFromSlot(s, 0);
    expect(res?.grade).toBe('perfect');
    expect(s.cash).toBe(PAYOUT.perfect);
    expect(s.served).toBe(1);
    expect(s.combo).toBe(1);
    expect(s.dogs).toHaveLength(0);
  });

  test('underdone dog still sells for the lower value', () => {
    const s = createState();
    startGame(s);
    startCooking(s, 1);
    s.dogs[0].cook = 3; // underdone
    s.customers.push(waitingCustomer());
    const res = serveFromSlot(s, 1);
    expect(res?.grade).toBe('good');
    expect(s.cash).toBe(PAYOUT.good);
  });

  test('overdone dog still sells for the lowest value', () => {
    const s = createState();
    startGame(s);
    startCooking(s, 2);
    s.dogs[0].cook = 20; // overdone
    s.customers.push(waitingCustomer());
    const res = serveFromSlot(s, 2);
    expect(res?.grade).toBe('overdone');
    expect(s.cash).toBe(PAYOUT.overdone);
  });

  test('does nothing when no customer is waiting', () => {
    const s = createState();
    startGame(s);
    startCooking(s, 0);
    s.dogs[0].cook = 10;
    expect(serveFromSlot(s, 0)).toBeNull();
    expect(s.dogs).toHaveLength(1);
  });
});

describe('step (90-second shift)', () => {
  test('cooking accrues in real seconds', () => {
    const s = createState();
    startGame(s);
    startCooking(s, 0);
    step(s, 8);
    expect(s.dogs[0].cook).toBeCloseTo(8);
    expect(gradeOf(s.dogs[0].cook)).toBe('perfect');
  });

  test('the shift clock counts down and ends the game at zero', () => {
    const s = createState();
    startGame(s);
    expect(s.timeLeft).toBe(SHIFT.duration);
    step(s, SHIFT.duration + 1);
    expect(s.timeLeft).toBe(0);
    expect(s.phase).toBe('gameover');
  });

  test('a customer who runs out of patience is counted missed and breaks combo', () => {
    const s = createState();
    startGame(s);
    s.combo = 4;
    s.customers.push({ id: 1, slot: 0, patience: 0.5, patienceMax: 5, served: false, leaving: false });
    const { missed } = step(s, 1);
    expect(missed).toBe(true);
    expect(s.missed).toBe(1);
    expect(s.combo).toBe(0);
  });

  test('customers spawn on the constant 8s cadence', () => {
    const s = createState();
    startGame(s);
    s.spawnTimer = RULES.spawnInterval;
    step(s, RULES.spawnInterval + 0.1);
    expect(s.customers.length).toBeGreaterThanOrEqual(1);
  });
});
