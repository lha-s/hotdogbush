// Tunable game balance. Kept in one place so difficulty is easy to reason about.

export const BOARD = {
  width: 960,
  height: 560,
} as const;

// A play session is a fixed 90-second shift (matches the original Hot Dog Bush).
export const SHIFT = {
  duration: 90, // seconds
} as const;

// Layout mirrors the original's zones (our own art): customers across the top with order bubbles
// above their faces; condiments + trash down the left; the GRILL stacked on the RIGHT; the prep
// table and hot-dog buns in the centre.
export const GRILL = {
  slots: 3, // original grill has 3 cook positions
  x: 664, // right side
  y: 150,
  slotW: 284,
  slotH: 80,
  gap: 16, // stacked vertically
} as const;

// Prep table — build several orders at once (original Table holds 3 breads). Centre, horizontal.
export const TABLE = {
  slots: 3,
  x: 156,
  slotW: 150,
  slotH: 124,
  y: 246,
  gap: 22,
} as const;

export const CUSTOMER = {
  max: 5, // original has 5 customer spots
  slotW: 176,
  slotH: 86, // face card; the order ticket renders in a bubble above it
  y: 56,
  gap: 12,
  bubbleY: 2,
  bubbleH: 50,
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

// Economy mirrors the original: a hot dog = bun ($10) + sausage value ($6/$10/$5);
// ketchup adds $3 when wanted (and docks $2 if wanted but missing); a drink adds $7.
export const PAYOUT = {
  bun: 10,
  perfect: 10, // sausage value by doneness
  good: 6,
  overdone: 5,
  ketchup: 3,
  ketchupMiss: 2, // penalty when the order wanted ketchup and didn't get it
  drink: 7,
  comboStep: 1, // small streak bonus (our addition; gives the leaderboard more spread)
  comboMax: 5,
} as const;

// SPEED MODE (not career): no cash goal — race the 90s clock for the highest score.
// Difficulty ramps over the shift: customers arrive faster and grow less patient.

// Shift phase boundaries (seconds): elapsed < RUSH = WARMUP, then RUSH, PEAK, CRUNCH.
export const PHASES = { RUSH: 18, PEAK: 45, CRUNCH: 72 } as const;

// Customer spawn cadence: the gap lerps startGap -> minGap over `rampTo` seconds, with ±jitter.
export const SPAWN = { startGap: 8.0, minGap: 2.8, rampTo: 72, jitter: 0.25 } as const;

// Patience shortens one step per phase (15 / 13 / 11 / 9 seconds), floored at min.
export const PATIENCE = { base: 15, perPhaseDrop: 2, min: 9 } as const;

// Cash that appears after a serve lingers on the counter, then vanishes (original moneyTimer = 2.5s).
export const CASH = {
  life: 3.5, // s — a touch longer than the original so it's tappable on mobile
  radius: 30, // px — tap target for collecting a cash token
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
  plateActive: '#ffe79b',
  station: '#2a201a',
  stationActive: '#473527',
  cash: '#5fd07a',
} as const;

// Plausibility ceiling used client-side and re-checked server-side (anti-cheat sanity bound).
// Max realistic cash for one ~minutes-long run; the edge function rejects anything above this.
export const MAX_PLAUSIBLE_SCORE = 100_000;
