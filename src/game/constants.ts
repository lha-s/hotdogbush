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
  slotW: 132,
  slotH: 74,
  y: 250, // top of grill row
  gap: 16,
} as const;

export const CUSTOMER = {
  max: 4,
  slotW: 172,
  slotH: 116,
  y: 14,
  gap: 12,
} as const;

// Cooking is measured in SECONDS of grill time and matches the original's doneness steps:
//   0–7s   = underdone (servable, lower pay)
//   7–14s  = perfect   (best pay)
//   14–21s = overdone  (servable, low pay)
//   >=21s  = burnt     (worthless — must be thrown in the trash to free the slot)
export const COOK = {
  perfectFrom: 7, // s — reaches perfect doneness (original advances state every 7s)
  overdoneFrom: 14, // s — slips to overdone
  burntFrom: 21, // s — ruined; can only be trashed
  meterMax: 24, // s — visual ceiling for the cook meter
} as const;

// Sausage values mirror the original (underdone 6, perfect 10, overdone 5). Ketchup and a
// drink each add to the ticket total; a drink-only order pays just the drink value.
export const PAYOUT = {
  perfect: 10,
  good: 6, // underdone but servable
  overdone: 5,
  ketchup: 2,
  drink: 4,
  comboStep: 1, // small streak bonus (our addition; gives the leaderboard more spread)
  comboMax: 5,
} as const;

export const RULES = {
  spawnInterval: 8, // s — constant, matches original timerCustomers.Interval = 8000ms
  patience: 13, // s — not specified in the original source; tuned so customers queue sensibly
} as const;

// Cash that appears after a serve lingers on the counter, then vanishes (original moneyTimer = 2.5s).
export const CASH = {
  life: 3.5, // s — a touch longer than the original so it's tappable on mobile
  radius: 28, // px — tap target for collecting a cash token
} as const;

// The five order combinations from the original OrderList (Sausage / Ketchup / Glass).
export const ORDER_COMBOS: ReadonlyArray<{ sausage: boolean; ketchup: boolean; drink: boolean }> = [
  { sausage: true, ketchup: true, drink: false }, // dog + ketchup
  { sausage: true, ketchup: false, drink: false }, // plain dog
  { sausage: true, ketchup: true, drink: true }, // dog + ketchup + drink
  { sausage: true, ketchup: false, drink: true }, // dog + drink
  { sausage: false, ketchup: false, drink: true }, // drink only
];

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
  ketchup: '#e23a28',
  mustard: '#f4b400',
  drink: '#7fc8e0',
  plate: '#cfd6dd',
  station: '#2a201a',
  stationActive: '#473527',
  cash: '#5fd07a',
} as const;

// Plausibility ceiling used client-side and re-checked server-side (anti-cheat sanity bound).
// Max realistic cash for one ~minutes-long run; the edge function rejects anything above this.
export const MAX_PLAUSIBLE_SCORE = 100_000;
