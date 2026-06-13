// Tunable game balance. Kept in one place so difficulty is easy to reason about.

export const BOARD = {
  width: 800,
  height: 500,
} as const;

export const GRILL = {
  slots: 4,
  slotW: 150,
  slotH: 70,
  y: 380, // top of grill row
  gap: 16,
} as const;

export const CUSTOMER = {
  max: 4,
  slotW: 170,
  slotH: 120,
  y: 30,
  gap: 12,
} as const;

// Cooking: a dog's `cook` goes 0 -> 1 over COOK_TIME, then keeps rising into "burnt".
export const COOK = {
  // seconds of cooking to traverse the full raw->burnt range
  fullTime: 4.5,
  // doneness bands (fraction of fullTime)
  rawUntil: 0.42, // < this = undercooked (rejected)
  perfectFrom: 0.42,
  perfectTo: 0.72, // green zone
  goodTo: 0.86, // acceptable but lower pay
  // > goodTo and still rising = burnt (rejected, occupies slot until cleared)
  burntAt: 0.92,
} as const;

export const PAYOUT = {
  perfect: 8,
  good: 5,
  edge: 2,
  comboStep: 1, // extra cash per combo level
  comboMax: 5,
} as const;

export const RULES = {
  startLives: 3,
  // spawn cadence ramps with elapsed time
  spawnStart: 3.2, // seconds between customers at t=0
  spawnMin: 1.1,
  spawnRampPer: 22, // each N seconds, spawn interval tightens
  patienceStart: 11, // seconds a customer waits
  patienceMin: 5.5,
} as const;

export const PALETTE = {
  grillCold: '#2a2a2e',
  grillHot: '#3a2018',
  ember: '#e23a28',
  raw: '#e7a9a0',
  perfect: '#a9602f',
  burnt: '#241712',
  bun: '#e6b25c',
  meterBg: '#000',
  meterPerfect: '#5fa83a',
  meterRaw: '#f4b400',
  meterBurnt: '#e23a28',
  text: '#f7ecd9',
  muted: '#b69b80',
  customerBody: '#3a2c22',
  patienceGood: '#5fa83a',
  patienceLow: '#e23a28',
} as const;

// Plausibility ceiling used client-side and re-checked server-side (anti-cheat sanity bound).
// Max realistic cash for one ~minutes-long run; the edge function rejects anything above this.
export const MAX_PLAUSIBLE_SCORE = 100_000;
