// Tunable game balance. Kept in one place so difficulty is easy to reason about.

export const BOARD = {
  width: 800,
  height: 500,
} as const;

// A play session is a fixed 90-second shift (matches the original Hot Dog Bush).
export const SHIFT = {
  duration: 90, // seconds
} as const;

export const GRILL = {
  slots: 3, // original grill has 3 sausage positions
  slotW: 180,
  slotH: 74,
  y: 380, // top of grill row
  gap: 20,
} as const;

export const CUSTOMER = {
  max: 4,
  slotW: 170,
  slotH: 120,
  y: 30,
  gap: 12,
} as const;

// Cooking is measured in SECONDS of grill time and matches the original's doneness steps:
//   0–7s  = underdone  (servable, lower pay)
//   7–14s = perfect    (best pay)
//   >=14s = overdone   (still servable, low pay) — you never "ruin" a dog, you just earn less.
export const COOK = {
  perfectFrom: 7, // s — reaches perfect doneness (original advances state every 7s)
  overdoneFrom: 14, // s — slips to overdone
  meterMax: 21, // s — visual ceiling for the cook meter
} as const;

// Payouts mirror the original sausage values: underdone 6, perfect 10, overdone 5.
export const PAYOUT = {
  perfect: 10,
  good: 6, // underdone but servable
  overdone: 5,
  comboStep: 1, // small streak bonus (our addition; gives the leaderboard more spread)
  comboMax: 5,
} as const;

export const RULES = {
  spawnInterval: 8, // s — constant, matches original timerCustomers.Interval = 8000ms
  patience: 12, // s — not specified in the original source; tuned so customers queue sensibly
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
