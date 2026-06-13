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

// ---- grill ----
const grillStartX = rowStart(GRILL.slots, GRILL.slotW, GRILL.gap);
export function grillSlotRect(slot: number): Rect {
  return { x: grillStartX + slot * (GRILL.slotW + GRILL.gap), y: GRILL.y, w: GRILL.slotW, h: GRILL.slotH };
}

// ---- prep table ----
const tableStartX = rowStart(TABLE.slots, TABLE.slotW, TABLE.gap);
export function tableSlotRect(slot: number): Rect {
  return { x: tableStartX + slot * (TABLE.slotW + TABLE.gap), y: TABLE.y, w: TABLE.slotW, h: TABLE.slotH };
}

// ---- customers ----
const custStartX = rowStart(CUSTOMER.max, CUSTOMER.slotW, CUSTOMER.gap);
export function customerSlotRect(slot: number): Rect {
  return { x: custStartX + slot * (CUSTOMER.slotW + CUSTOMER.gap), y: CUSTOMER.y, w: CUSTOMER.slotW, h: CUSTOMER.slotH };
}

// ---- stations (counter, flanking the grill/table) ----
export const STATION_RECTS: Record<Station, Rect> = {
  bun: { x: 16, y: 180, w: 132, h: 92 },
  ketchup: { x: 16, y: 300, w: 132, h: 92 },
  drink: { x: BOARD.width - 148, y: 180, w: 132, h: 92 },
  trash: { x: BOARD.width - 148, y: 300, w: 132, h: 92 },
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
