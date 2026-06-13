import { CUSTOMER, GRILL } from './constants.ts';
import type { Station } from './types.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BOARD_W = 800;

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// ---- grill ----
const grillRowWidth = GRILL.slots * GRILL.slotW + (GRILL.slots - 1) * GRILL.gap;
const grillStartX = (BOARD_W - grillRowWidth) / 2;

export function grillSlotRect(slot: number): Rect {
  return { x: grillStartX + slot * (GRILL.slotW + GRILL.gap), y: GRILL.y, w: GRILL.slotW, h: GRILL.slotH };
}

// ---- customers ----
const custRowWidth = CUSTOMER.max * CUSTOMER.slotW + (CUSTOMER.max - 1) * CUSTOMER.gap;
const custStartX = (BOARD_W - custRowWidth) / 2;

export function customerSlotRect(slot: number): Rect {
  return { x: custStartX + slot * (CUSTOMER.slotW + CUSTOMER.gap), y: CUSTOMER.y, w: CUSTOMER.slotW, h: CUSTOMER.slotH };
}

// ---- plate (assembly area) ----
export const PLATE_RECT: Rect = { x: 320, y: 356, w: 160, h: 128 };

// ---- stations (counter) ----
export const STATION_RECTS: Record<Station, Rect> = {
  bun: { x: 24, y: 250, w: 140, h: 84 },
  ketchup: { x: 24, y: 346, w: 140, h: 84 },
  drink: { x: 636, y: 250, w: 140, h: 84 },
  trash: { x: 636, y: 346, w: 140, h: 84 },
};

export type Target =
  | { kind: 'grill'; slot: number }
  | { kind: 'customer'; slot: number }
  | { kind: 'station'; station: Station }
  | { kind: 'plate' };

/** Hit-test a board-space point against the static layout (cash tokens are tested separately). */
export function targetAt(px: number, py: number): Target | null {
  for (let s = 0; s < GRILL.slots; s++) {
    if (pointInRect(px, py, grillSlotRect(s))) return { kind: 'grill', slot: s };
  }
  for (let s = 0; s < CUSTOMER.max; s++) {
    if (pointInRect(px, py, customerSlotRect(s))) return { kind: 'customer', slot: s };
  }
  for (const station of Object.keys(STATION_RECTS) as Station[]) {
    if (pointInRect(px, py, STATION_RECTS[station])) return { kind: 'station', station };
  }
  if (pointInRect(px, py, PLATE_RECT)) return { kind: 'plate' };
  return null;
}
