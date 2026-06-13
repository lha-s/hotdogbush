import { BOARD, CUSTOMER, GRILL, TABLE } from './constants.ts';
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

function rowStart(count: number, slotW: number, gap: number): number {
  return (BOARD.width - (count * slotW + (count - 1) * gap)) / 2;
}

// ---- grill (right side, stacked vertically) ----
export function grillSlotRect(slot: number): Rect {
  return { x: GRILL.x, y: GRILL.y + slot * (GRILL.slotH + GRILL.gap), w: GRILL.slotW, h: GRILL.slotH };
}

// ---- prep table (centre, horizontal) ----
export function tableSlotRect(slot: number): Rect {
  return { x: TABLE.x + slot * (TABLE.slotW + TABLE.gap), y: TABLE.y, w: TABLE.slotW, h: TABLE.slotH };
}

// ---- customers (top row) ----
const custStartX = rowStart(CUSTOMER.max, CUSTOMER.slotW, CUSTOMER.gap);
export function customerSlotRect(slot: number): Rect {
  return { x: custStartX + slot * (CUSTOMER.slotW + CUSTOMER.gap), y: CUSTOMER.y, w: CUSTOMER.slotW, h: CUSTOMER.slotH };
}
/** The speech-bubble order ticket drawn above each customer's face. */
export function customerBubbleRect(slot: number): Rect {
  const face = customerSlotRect(slot);
  return { x: face.x + 8, y: CUSTOMER.bubbleY, w: face.w - 16, h: CUSTOMER.bubbleH };
}

// ---- stations: condiments + trash down the left, hot-dog buns centre ----
export const STATION_RECTS: Record<Station, Rect> = {
  ketchup: { x: 10, y: 152, w: 130, h: 80 },
  trash: { x: 10, y: 244, w: 130, h: 84 },
  drink: { x: 10, y: 340, w: 130, h: 84 },
  bun: { x: 300, y: 158, w: 150, h: 72 },
};

export type Target =
  | { kind: 'grill'; slot: number }
  | { kind: 'table'; slot: number }
  | { kind: 'customer'; slot: number }
  | { kind: 'station'; station: Station };

/** Hit-test a board-space point against the static layout (cash tokens are tested separately). */
export function targetAt(px: number, py: number): Target | null {
  for (let s = 0; s < GRILL.slots; s++) {
    if (pointInRect(px, py, grillSlotRect(s))) return { kind: 'grill', slot: s };
  }
  for (let s = 0; s < TABLE.slots; s++) {
    if (pointInRect(px, py, tableSlotRect(s))) return { kind: 'table', slot: s };
  }
  for (let s = 0; s < CUSTOMER.max; s++) {
    if (pointInRect(px, py, customerSlotRect(s))) return { kind: 'customer', slot: s };
  }
  for (const station of Object.keys(STATION_RECTS) as Station[]) {
    if (pointInRect(px, py, STATION_RECTS[station])) return { kind: 'station', station };
  }
  return null;
}
