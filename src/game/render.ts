import { sprite, type SpriteKey } from './assets.ts';
import { APPLIANCE_COOK, BOARD, CASH, GRILL, PALETTE, TABLE } from './constants.ts';
import { FRYER, PAN, STATION_RECTS, customerBubbleRect, customerSlotRect, fryerSlotRect, grillSlotRect, panSlotRect, tableSlotRect, targetAt } from './geometry.ts';
import type { Rect } from './geometry.ts';
import { gradeOfItem, isBurntItem } from './logic.ts';
import type { CookItem, GameState, Order, Plate, ServeFx } from './types.ts';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawSprite(ctx: CanvasRenderingContext2D, key: SpriteKey, x: number, y: number, w: number, h: number): boolean {
  const img = sprite(key);
  if (!img) return false;
  ctx.drawImage(img, x, y, w, h);
  return true;
}

// ---------------------------------------------------------------------------
function drawBackground(ctx: CanvasRenderingContext2D): void {
  if (!drawSprite(ctx, 'bg', 0, 0, BOARD.width, BOARD.height)) {
    ctx.fillStyle = '#181009';
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  }
  ctx.fillStyle = 'rgba(20,14,9,0.78)';
  ctx.fillRect(0, GRILL.y - 30, BOARD.width, BOARD.height - GRILL.y + 30);
}

// ---- stations ----
function drawStationBox(ctx: CanvasRenderingContext2D, r: Rect, label: string, active: boolean): void {
  ctx.fillStyle = active ? PALETTE.stationActive : PALETTE.station;
  roundRect(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.fill();
  ctx.strokeStyle = active ? PALETTE.mustard : 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 3;
  roundRect(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 14px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h - 8);
}

function drawBunIcon(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + 32;
  if (!drawSprite(ctx, 'bun', cx - 48, cy - 16, 96, 40)) {
    ctx.fillStyle = PALETTE.bun;
    roundRect(ctx, cx - 42, cy - 10, 84, 24, 12);
    ctx.fill();
  }
}

function drawBottleIcon(ctx: CanvasRenderingContext2D, x: number, y: number, body: string, cap: string): void {
  ctx.fillStyle = body;
  roundRect(ctx, x - 9, y, 18, 30, 7);
  ctx.fill();
  ctx.fillStyle = cap;
  roundRect(ctx, x - 5, y - 8, 10, 9, 3);
  ctx.fill();
}

function drawDrinkIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#dfe6ec';
  ctx.beginPath();
  ctx.moveTo(x - 13, y);
  ctx.lineTo(x + 13, y);
  ctx.lineTo(x + 9, y + 32);
  ctx.lineTo(x - 9, y + 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.drink;
  ctx.fillRect(x - 11, y + 4, 22, 12);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 8);
  ctx.lineTo(x + 7, y + 28);
  ctx.stroke();
}

function drawTrashIcon(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + 12;
  ctx.fillStyle = '#5a5550';
  roundRect(ctx, cx - 15, cy, 30, 36, 4);
  ctx.fill();
  ctx.fillStyle = '#74706a';
  roundRect(ctx, cx - 19, cy - 6, 38, 8, 3);
  ctx.fill();
  ctx.strokeStyle = '#2a2824';
  ctx.lineWidth = 2;
  for (const dx of [-7, 0, 7]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy + 6);
    ctx.lineTo(cx + dx, cy + 30);
    ctx.stroke();
  }
}

function drawStations(ctx: CanvasRenderingContext2D, state: GameState): void {
  const plates = state.plates;
  const hasEmpty = plates.includes(null);
  const canKetchup = plates.some((p) => p && (p.sausage !== null || p.patty !== null) && !p.ketchup);
  const canDrink = hasEmpty || plates.some((p) => p && !p.drink);

  drawStationBox(ctx, STATION_RECTS.bun, 'Bun', hasEmpty);
  drawBunIcon(ctx, STATION_RECTS.bun);
  drawStationBox(ctx, STATION_RECTS.burgerBun, 'Burger Bun', hasEmpty);
  drawBurgerBunIcon(ctx, STATION_RECTS.burgerBun);
  const canMustard = plates.some((p) => p && (p.sausage !== null || p.patty !== null) && !p.mustard);
  drawStationBox(ctx, STATION_RECTS.ketchup, 'Ketchup', canKetchup);
  drawBottleIcon(ctx, STATION_RECTS.ketchup.x + STATION_RECTS.ketchup.w / 2, STATION_RECTS.ketchup.y + 14, PALETTE.ketchup, '#7a1d13');
  drawStationBox(ctx, STATION_RECTS.mustard, 'Mustard', canMustard);
  drawBottleIcon(ctx, STATION_RECTS.mustard.x + STATION_RECTS.mustard.w / 2, STATION_RECTS.mustard.y + 14, PALETTE.mustard, '#8a6606');
  drawStationBox(ctx, STATION_RECTS.drink, 'Drink', canDrink);
  drawDrinkIcon(ctx, STATION_RECTS.drink.x + STATION_RECTS.drink.w / 2, STATION_RECTS.drink.y + 12);
  drawStationBox(ctx, STATION_RECTS.rawPatty, 'Patties', true);
  drawPattyIcon(ctx, STATION_RECTS.rawPatty);
  drawStationBox(ctx, STATION_RECTS.rawPotato, 'Potatoes', true);
  drawSourceSprite(ctx, STATION_RECTS.rawPotato, 'friesRaw');
  drawStationBox(ctx, STATION_RECTS.rawOnion, 'Onions', true);
  drawSourceSprite(ctx, STATION_RECTS.rawOnion, 'onionRaw');
  drawStationBox(ctx, STATION_RECTS.trash, 'Trash', false);
  drawTrashIcon(ctx, STATION_RECTS.trash);
}

function drawSourceSprite(ctx: CanvasRenderingContext2D, r: Rect, key: SpriteKey): void {
  drawSprite(ctx, key, r.x + r.w / 2 - 24, r.y + 8, 48, 40);
}

function drawBurgerBunIcon(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + 28;
  if (!drawSprite(ctx, 'burgerBun', cx - 44, cy - 16, 88, 44)) {
    ctx.fillStyle = PALETTE.bun;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 36, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPattyIcon(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + 30;
  if (!drawSprite(ctx, 'pattyRaw', cx - 44, cy - 12, 88, 32)) {
    ctx.fillStyle = '#b86464';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 38, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- appliances ----
function itemSpriteKey(item: CookItem): SpriteKey {
  const raw = item.cook < APPLIANCE_COOK[item.station].perfectFrom;
  if (item.kind === 'patty') return isBurntItem(item) ? 'pattyBurnt' : raw ? 'pattyRaw' : 'pattyCooked';
  if (item.kind === 'fries') return raw ? 'friesRaw' : 'friesCooked';
  if (item.kind === 'onion') return raw ? 'onionRaw' : 'onionCooked';
  return isBurntItem(item) ? 'sausageBurnt' : raw ? 'sausageRaw' : 'sausageCooked';
}

function drawGrill(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (let s = 0; s < GRILL.slots; s++) {
    const r = grillSlotRect(s);
    const dog = state.dogs.find((d) => d.station === 'grill' && d.slot === s);
    ctx.fillStyle = dog ? PALETTE.grillHot : PALETTE.grillCold;
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    for (let i = 1; i < 5; i++) {
      const gx = r.x + (r.w / 5) * i;
      ctx.beginPath();
      ctx.moveTo(gx, r.y + 6);
      ctx.lineTo(gx, r.y + r.h - 6);
      ctx.stroke();
    }
    if (!dog) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('tap to cook', r.x + r.w / 2, r.y + r.h / 2);
      continue;
    }
    drawDog(ctx, dog, r);
  }
  // grill label
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('GRILL', GRILL.x + GRILL.slotW / 2, GRILL.y - 6);
}

function drawDog(ctx: CanvasRenderingContext2D, item: CookItem, r: Rect): void {
  const bands = APPLIANCE_COOK[item.station];
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 - 6;
  const wide = item.kind === 'sausage' || item.kind === 'patty';
  const spriteW = Math.min(r.w - 8, 104);
  const spriteH = wide ? (spriteW * 44) / 120 : spriteW * 0.72;
  drawSprite(ctx, itemSpriteKey(item), cx - spriteW / 2, cy - spriteH / 2, spriteW, spriteH);

  if (isBurntItem(item)) {
    ctx.fillStyle = PALETTE.ember;
    ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(r.w < 140 ? '🔥' : '🔥 burnt — trash it', cx, r.y + r.h - 12);
    return;
  }

  const meterW = r.w - 16;
  const mx = r.x + 8;
  const my = r.y + r.h - 12;
  ctx.fillStyle = PALETTE.meterBg;
  roundRect(ctx, mx, my, meterW, 6, 3);
  ctx.fill();
  const zStart = mx + meterW * (bands.perfectFrom / bands.meterMax);
  const zEnd = mx + meterW * (bands.overdoneFrom / bands.meterMax);
  ctx.fillStyle = 'rgba(95,168,58,0.4)';
  ctx.fillRect(zStart, my, zEnd - zStart, 6);
  const grade = gradeOfItem(item);
  ctx.fillStyle = grade === 'perfect' ? PALETTE.meterPerfect : grade === 'good' ? PALETTE.meterRaw : PALETTE.meterBurnt;
  roundRect(ctx, mx, my, meterW * Math.min(1, item.cook / bands.meterMax), 6, 3);
  ctx.fill();
}

/** Generic appliance drawer for the fryer and onion pan. */
function drawAppliance(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  station: 'fryer' | 'pan',
  slotRect: (s: number) => Rect,
  slots: number,
  label: string,
): void {
  for (let s = 0; s < slots; s++) {
    const r = slotRect(s);
    const item = state.dogs.find((d) => d.station === station && d.slot === s);
    ctx.fillStyle = item ? PALETTE.grillHot : PALETTE.grillCold;
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.stroke();
    if (item) drawDog(ctx, item, r);
  }
  const first = slotRect(0);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, first.x, first.y - 4);
}

// ---- prep table ----
function drawDrizzle(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const px = cx - 38 + i * 13;
    const py = cy + 6 + (i % 2 === 0 ? -4 : 4);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawPlateContents(ctx: CanvasRenderingContext2D, plate: Plate, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h - 42;
  if (plate.bun && !drawSprite(ctx, 'bun', cx - 56, cy - 8, 104, 44)) {
    ctx.fillStyle = PALETTE.bun;
    roundRect(ctx, cx - 50, cy, 94, 24, 12);
    ctx.fill();
  }
  if (plate.burgerBun && !drawSprite(ctx, 'burgerBun', cx - 50, cy - 18, 100, 56)) {
    ctx.fillStyle = PALETTE.bun;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 42, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (plate.sausage) {
    drawSprite(ctx, 'sausageCooked', cx - 46, cy - 2, 92, 34);
    if (plate.onion) drawSprite(ctx, 'onionCooked', cx - 30, cy - 8, 60, 18);
    if (plate.ketchup) drawDrizzle(ctx, cx, cy, PALETTE.ketchup);
    if (plate.mustard) drawDrizzle(ctx, cx, cy + 6, PALETTE.mustard);
  }
  if (plate.patty) {
    drawSprite(ctx, 'pattyCooked', cx - 44, cy - 2, 88, 30);
    if (plate.onion) drawSprite(ctx, 'onionCooked', cx - 30, cy - 10, 60, 18);
    if (plate.ketchup) drawDrizzle(ctx, cx, cy - 4, PALETTE.ketchup);
    if (plate.mustard) drawDrizzle(ctx, cx, cy + 2, PALETTE.mustard);
  }
  if (plate.fries) drawSprite(ctx, 'friesCooked', r.x + 6, r.y + 6, 40, 40);
  if (plate.drink) drawDrinkIcon(ctx, r.x + r.w - 24, r.y + 14);
}

function drawTable(ctx: CanvasRenderingContext2D, state: GameState, hoverSlot: number): void {
  for (let s = 0; s < TABLE.slots; s++) {
    const r = tableSlotRect(s);
    const plate = state.plates[s];
    const hovered = hoverSlot === s;

    // dish
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.fillStyle = hovered ? PALETTE.plateActive : PALETTE.plate;
    ctx.beginPath();
    ctx.ellipse(r.x + r.w / 2, r.y + r.h - 26, r.w / 2 - 10, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    if (hovered) {
      ctx.strokeStyle = PALETTE.mustard;
      ctx.lineWidth = 3;
      roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    if (!plate) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = 'italic 12px ui-sans-serif, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('empty', r.x + r.w / 2, r.y + r.h / 2);
    } else {
      drawPlateContents(ctx, plate, r);
    }
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('PREP TABLE — drop cooked items & toppings here', TABLE.x + (TABLE.slots * TABLE.slotW + (TABLE.slots - 1) * TABLE.gap) / 2, TABLE.y - 6);
}

// ---- customers ----
function orderText(order: Order): string {
  if (!order.sausage) return 'drink only';
  let t = 'hot dog';
  if (order.ketchup) t += ' + ketchup';
  if (order.drink) t += ' + drink';
  return t;
}

function drawOrderIcons(ctx: CanvasRenderingContext2D, order: Order, cx: number, y: number): void {
  const items: string[] = [];
  if (order.sausage) items.push('🌭');
  if (order.ketchup) items.push('🥫');
  if (order.drink) items.push('🥤');
  ctx.font = '20px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(items.join('  '), cx, y);
}

function drawCustomers(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const c of state.customers) {
    if (c.served) continue;
    const face = customerSlotRect(c.slot);
    const bubble = customerBubbleRect(c.slot);
    const oy = (1 - c.appear) * -20;
    ctx.globalAlpha = 0.25 + 0.75 * c.appear;
    const impatient = c.patience / c.patienceMax < 0.35;

    // --- order bubble (above the face) ---
    const b = { x: bubble.x, y: bubble.y + oy, w: bubble.w, h: bubble.h };
    ctx.fillStyle = '#f7ecd9';
    roundRect(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    // little tail pointing down to the face
    ctx.beginPath();
    ctx.moveTo(b.x + b.w / 2 - 8, b.y + b.h);
    ctx.lineTo(b.x + b.w / 2 + 8, b.y + b.h);
    ctx.lineTo(b.x + b.w / 2, b.y + b.h + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#241712';
    drawOrderIcons(ctx, c.order, b.x + b.w / 2, b.y + 18);
    ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(orderText(c.order), b.x + b.w / 2, b.y + 38);

    // --- face card ---
    const r = { x: face.x, y: face.y + oy, w: face.w, h: face.h };
    ctx.fillStyle = PALETTE.customerBody;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = impatient ? PALETTE.patienceLow : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.stroke();

    const key: SpriteKey = c.id % 2 === 0 ? 'customer1' : 'customer2';
    if (!drawSprite(ctx, key, r.x + r.w / 2 - 28, r.y + 6, 56, 56)) {
      ctx.font = '30px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(impatient ? '😠' : '🙂', r.x + r.w / 2, r.y + 32);
    }
    if (impatient) {
      ctx.font = '16px serif';
      ctx.fillText('💢', r.x + r.w - 16, r.y + 16);
    }

    // patience bar
    const pw = r.w - 20;
    const px = r.x + 10;
    const py = r.y + r.h - 12;
    ctx.fillStyle = '#000';
    roundRect(ctx, px, py, pw, 6, 3);
    ctx.fill();
    const frac = Math.max(0, c.patience / c.patienceMax);
    ctx.fillStyle = impatient ? PALETTE.patienceLow : PALETTE.patienceGood;
    roundRect(ctx, px, py, pw * frac, 6, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---- cash + fx ----
function drawCashTokens(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const t of state.cashTokens) {
    const fade = Math.min(1, t.life / 1.2);
    ctx.globalAlpha = 0.4 + 0.6 * fade;
    ctx.fillStyle = PALETTE.cash;
    ctx.beginPath();
    ctx.arc(t.x, t.y, CASH.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c5a2a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#0c3016';
    ctx.font = '700 16px Arial Black, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${t.amount}`, t.x, t.y);
    ctx.globalAlpha = 1;
  }
}

function drawFx(ctx: CanvasRenderingContext2D, fx: ServeFx[]): void {
  for (const f of fx) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.fillStyle = f.color;
    ctx.font = '700 18px Arial Black, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// ---- drag ghost + drop-target highlight ----
export interface DragView {
  kind: 'sausage' | 'patty' | 'fries' | 'onion' | 'plate' | 'ketchup' | 'mustard' | 'drink' | 'rawPatty' | 'rawPotato' | 'rawOnion';
  x: number;
  y: number;
  slot?: number;
}

function highlightTarget(ctx: CanvasRenderingContext2D, drag: DragView): number {
  const t = targetAt(drag.x, drag.y);
  if (!t) return -1;
  if (t.kind === 'table') return t.slot; // handled as hover in drawTable
  if (t.kind === 'customer' && drag.kind === 'plate') {
    const r = customerSlotRect(t.slot);
    ctx.strokeStyle = PALETTE.cash;
    ctx.lineWidth = 4;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.stroke();
  } else if (t.kind === 'station' && t.station === 'trash') {
    const r = STATION_RECTS.trash;
    ctx.strokeStyle = PALETTE.meterBurnt;
    ctx.lineWidth = 4;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.stroke();
  }
  return -1;
}

function drawDragGhost(ctx: CanvasRenderingContext2D, state: GameState, drag: DragView): void {
  ctx.save();
  ctx.globalAlpha = 0.9;
  const { x, y } = drag;
  if (drag.kind === 'sausage') {
    if (!drawSprite(ctx, 'sausageCooked', x - 48, y - 18, 96, 36)) {
      ctx.fillStyle = PALETTE.perfect;
      roundRect(ctx, x - 44, y - 11, 88, 22, 11);
      ctx.fill();
    }
  } else if (drag.kind === 'patty' || drag.kind === 'rawPatty') {
    const key = drag.kind === 'rawPatty' ? 'pattyRaw' : 'pattyCooked';
    if (!drawSprite(ctx, key, x - 44, y - 16, 88, 32)) {
      ctx.fillStyle = drag.kind === 'rawPatty' ? '#b86464' : '#5a3618';
      ctx.beginPath();
      ctx.ellipse(x, y, 40, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (drag.kind === 'fries' || drag.kind === 'rawPotato') {
    drawSprite(ctx, drag.kind === 'rawPotato' ? 'friesRaw' : 'friesCooked', x - 24, y - 24, 48, 48);
  } else if (drag.kind === 'onion' || drag.kind === 'rawOnion') {
    drawSprite(ctx, drag.kind === 'rawOnion' ? 'onionRaw' : 'onionCooked', x - 30, y - 20, 60, 40);
  } else if (drag.kind === 'ketchup') {
    drawBottleIcon(ctx, x, y - 14, PALETTE.ketchup, '#7a1d13');
  } else if (drag.kind === 'mustard') {
    drawBottleIcon(ctx, x, y - 14, PALETTE.mustard, '#8a6606');
  } else if (drag.kind === 'drink') {
    drawDrinkIcon(ctx, x, y - 16);
  } else if (drag.kind === 'plate' && drag.slot != null) {
    const plate = state.plates[drag.slot];
    if (plate) {
      if (plate.bun && !drawSprite(ctx, 'bun', x - 52, y - 16, 100, 42)) {
        ctx.fillStyle = PALETTE.bun;
        roundRect(ctx, x - 46, y - 6, 92, 22, 11);
        ctx.fill();
      }
      if (plate.sausage) drawSprite(ctx, 'sausageCooked', x - 44, y - 14, 88, 32);
      if (plate.drink) drawDrinkIcon(ctx, x + 40, y - 16);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
export function render(ctx: CanvasRenderingContext2D, state: GameState, fx: ServeFx[], drag?: DragView | null): void {
  ctx.clearRect(0, 0, BOARD.width, BOARD.height);
  drawBackground(ctx);
  drawStations(ctx, state);
  drawGrill(ctx, state);
  drawAppliance(ctx, state, 'fryer', fryerSlotRect, FRYER.slots, 'FRYER');
  drawAppliance(ctx, state, 'pan', panSlotRect, PAN.slots, 'ONIONS');
  const hoverSlot = drag ? (() => { const t = targetAt(drag.x, drag.y); return t?.kind === 'table' ? t.slot : -1; })() : -1;
  drawTable(ctx, state, hoverSlot);
  drawCustomers(ctx, state);
  drawCashTokens(ctx, state);
  drawFx(ctx, fx);

  if (state.combo >= 2) {
    ctx.fillStyle = PALETTE.meterRaw;
    ctx.font = '700 18px Arial Black, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`🔥 ${state.combo}× combo`, BOARD.width - 160, GRILL.y - 24);
  }

  if (drag) {
    highlightTarget(ctx, drag);
    drawDragGhost(ctx, state, drag);
  }
}
