import { CUSTOMER, GRILL } from './constants.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const grillRowWidth = GRILL.slots * GRILL.slotW + (GRILL.slots - 1) * GRILL.gap;
const grillStartX = (800 - grillRowWidth) / 2;

export function grillSlotRect(slot: number): Rect {
  return {
    x: grillStartX + slot * (GRILL.slotW + GRILL.gap),
    y: GRILL.y,
    w: GRILL.slotW,
    h: GRILL.slotH,
  };
}

const custRowWidth = CUSTOMER.max * CUSTOMER.slotW + (CUSTOMER.max - 1) * CUSTOMER.gap;
const custStartX = (800 - custRowWidth) / 2;

export function customerSlotRect(slot: number): Rect {
  return {
    x: custStartX + slot * (CUSTOMER.slotW + CUSTOMER.gap),
    y: CUSTOMER.y,
    w: CUSTOMER.slotW,
    h: CUSTOMER.slotH,
  };
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/** Which grill slot (0..slots-1) was tapped, or -1. */
export function grillSlotAt(px: number, py: number): number {
  for (let s = 0; s < GRILL.slots; s++) {
    if (pointInRect(px, py, grillSlotRect(s))) return s;
  }
  return -1;
}
