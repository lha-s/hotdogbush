import type { Station } from './types.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// ---------------------------------------------------------------------------
// Calibrated zone rects (px @ 960x640). Traced from the real game's layout via
// an overlay calibration pass — our own coordinates, our own art.
// ---------------------------------------------------------------------------

// Grill: 3 patty positions (left) + 3 sausage positions (right), on the up-right diagonal.
const GRILL_SLOTS: Rect[] = [
  { x: 699, y: 410, w: 110, h: 83 }, // 0 patty A
  { x: 713, y: 352, w: 110, h: 83 }, // 1 patty B
  { x: 728, y: 294, w: 110, h: 83 }, // 2 patty C
  { x: 824, y: 403, w: 125, h: 70 }, // 3 sausage A
  { x: 833, y: 352, w: 120, h: 70 }, // 4 sausage B
  { x: 843, y: 301, w: 115, h: 70 }, // 5 sausage C
];
export function grillSlotRect(slot: number): Rect {
  return GRILL_SLOTS[slot];
}
/** Slots 0–2 are patty positions; 3–5 are sausage positions (visual hint, not a hard rule). */
export const GRILL_PATTY_SLOTS = [0, 1, 2];
export const GRILL_SAUSAGE_SLOTS = [3, 4, 5];

// Prep table: 3 hot-dog lanes (stacked) + 3 burger lanes (up-right diagonal).
const TABLE_SLOTS: Rect[] = [
  { x: 314, y: 352, w: 160, h: 52 }, // 0 hot-dog lane A
  { x: 314, y: 404, w: 160, h: 52 }, // 1 hot-dog lane B
  { x: 314, y: 457, w: 160, h: 55 }, // 2 hot-dog lane C
  { x: 484, y: 419, w: 86, h: 64 }, // 3 burger lane A
  { x: 497, y: 358, w: 86, h: 64 }, // 4 burger lane B
  { x: 511, y: 298, w: 86, h: 64 }, // 5 burger lane C
];
export function tableSlotRect(slot: number): Rect {
  return TABLE_SLOTS[slot];
}
export const DOG_LANES = [0, 1, 2];
export const BURGER_LANES = [3, 4, 5];

// Fryer: three fry-box slots along the bottom of the fryer zone (in front of the basket),
// kept right of the Trash zone (x 6–137). Plus the two diagonal onion pans.
export const FRYER = { slots: 3 } as const;
const FRYER_SLOTS: Rect[] = [
  { x: 142, y: 442, w: 52, h: 66 }, // fry box A
  { x: 199, y: 442, w: 52, h: 66 }, // fry box B
  { x: 256, y: 442, w: 52, h: 66 }, // fry box C
];
export function fryerSlotRect(slot: number): Rect {
  return FRYER_SLOTS[slot];
}

export const PAN = { slots: 2 } as const;
const PAN_SLOTS: Rect[] = [
  { x: 603, y: 323, w: 86, h: 90 }, // onion pan A (upper-right)
  { x: 569, y: 406, w: 88, h: 96 }, // onion pan B (lower-left)
];
export function panSlotRect(slot: number): Rect {
  return PAN_SLOTS[slot];
}

// Customers across the top; the order ticket renders in a bubble above each face.
const CUSTOMER_SLOTS: Rect[] = [
  { x: 3, y: 125, w: 188, h: 192 },
  { x: 192, y: 125, w: 188, h: 192 },
  { x: 384, y: 125, w: 188, h: 192 },
  { x: 576, y: 125, w: 188, h: 192 },
  { x: 768, y: 125, w: 189, h: 192 },
];
export function customerSlotRect(slot: number): Rect {
  return CUSTOMER_SLOTS[slot];
}
export function customerBubbleRect(slot: number): Rect {
  const f = CUSTOMER_SLOTS[slot];
  return { x: f.x + 6, y: 6, w: f.w - 12, h: 108 };
}

// Stations: condiments + trash on the left, bun-placers, and the bottom source shelf.
export const STATION_RECTS: Record<Station, Rect> = {
  ketchup: { x: 9, y: 266, w: 35, h: 99 },
  mustard: { x: 44, y: 266, w: 36, h: 99 },
  trash: { x: 6, y: 365, w: 131, h: 144 },
  bun: { x: 243, y: 515, w: 169, h: 83 }, // hot-dog bun source
  burgerBun: { x: 414, y: 515, w: 130, h: 83 }, // burger bun source
  cola: { x: 6, y: 515, w: 50, h: 83 },
  lemonade: { x: 58, y: 515, w: 54, h: 83 },
  rawPotato: { x: 115, y: 515, w: 129, h: 83 }, // -> fryer
  rawOnion: { x: 545, y: 515, w: 96, h: 83 }, // -> pan
  rawPatty: { x: 643, y: 515, w: 147, h: 83 }, // -> grill
  rawSausage: { x: 790, y: 515, w: 167, h: 83 }, // -> grill
};

export type Target =
  | { kind: 'grill'; slot: number }
  | { kind: 'fryer'; slot: number }
  | { kind: 'pan'; slot: number }
  | { kind: 'table'; slot: number }
  | { kind: 'customer'; slot: number }
  | { kind: 'station'; station: Station };

/** Hit-test a board-space point against the static layout (cash tokens are tested separately). */
export function targetAt(px: number, py: number): Target | null {
  for (let s = 0; s < GRILL_SLOTS.length; s++) if (pointInRect(px, py, GRILL_SLOTS[s])) return { kind: 'grill', slot: s };
  for (let s = 0; s < FRYER.slots; s++) if (pointInRect(px, py, FRYER_SLOTS[s])) return { kind: 'fryer', slot: s };
  for (let s = 0; s < PAN.slots; s++) if (pointInRect(px, py, PAN_SLOTS[s])) return { kind: 'pan', slot: s };
  for (let s = 0; s < TABLE_SLOTS.length; s++) if (pointInRect(px, py, TABLE_SLOTS[s])) return { kind: 'table', slot: s };
  for (let s = 0; s < CUSTOMER_SLOTS.length; s++) if (pointInRect(px, py, CUSTOMER_SLOTS[s])) return { kind: 'customer', slot: s };
  for (const station of Object.keys(STATION_RECTS) as Station[]) if (pointInRect(px, py, STATION_RECTS[station])) return { kind: 'station', station };
  return null;
}
