import { sprite, type SpriteKey } from './assets.ts';
import { BOARD, CASH, COOK, GRILL, PALETTE, TABLE } from './constants.ts';
import { STATION_RECTS, customerSlotRect, grillSlotRect, tableSlotRect, targetAt } from './geometry.ts';
import type { Rect } from './geometry.ts';
import { gradeOf, isBurnt } from './logic.ts';
import type { Dog, GameState, Order, Plate, ServeFx } from './types.ts';

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

function drawKetchupIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PALETTE.ketchup;
  roundRect(ctx, x - 9, y, 18, 30, 7);
  ctx.fill();
  ctx.fillStyle = '#7a1d13';
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
  const canKetchup = plates.some((p) => p && p.sausage !== null && !p.ketchup);
  const canDrink = plates.includes(null) || plates.some((p) => p && !p.drink);
  drawStationBox(ctx, STATION_RECTS.bun, 'Bun', plates.includes(null));
  drawBunIcon(ctx, STATION_RECTS.bun);
  drawStationBox(ctx, STATION_RECTS.ketchup, 'Ketchup', canKetchup);
  drawKetchupIcon(ctx, STATION_RECTS.ketchup.x + STATION_RECTS.ketchup.w / 2, STATION_RECTS.ketchup.y + 16);
  drawStationBox(ctx, STATION_RECTS.drink, 'Drink', canDrink);
  drawDrinkIcon(ctx, STATION_RECTS.drink.x + STATION_RECTS.drink.w / 2, STATION_RECTS.drink.y + 12);
  drawStationBox(ctx, STATION_RECTS.trash, 'Trash', false);
  drawTrashIcon(ctx, STATION_RECTS.trash);
}

// ---- grill ----
function sausageKeyFor(dog: Dog): SpriteKey {
  if (isBurnt(dog.cook)) return 'sausageBurnt';
  return dog.cook < COOK.perfectFrom ? 'sausageRaw' : 'sausageCooked';
}

function drawGrill(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (let s = 0; s < GRILL.slots; s++) {
    const r = grillSlotRect(s);
    const dog = state.dogs.find((d) => d.slot === s);
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
  ctx.fillText('GRILL', BOARD.width / 2, GRILL.y - 6);
}

function drawDog(ctx: CanvasRenderingContext2D, dog: Dog, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 - 6;
  const sw = 104;
  drawSprite(ctx, sausageKeyFor(dog), cx - sw / 2, cy - (sw * 44) / 120 / 2, sw, (sw * 44) / 120);

  if (isBurnt(dog.cook)) {
    ctx.fillStyle = PALETTE.ember;
    ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔥 burnt — trash it', cx, r.y + r.h - 12);
    return;
  }

  const meterW = r.w - 20;
  const mx = r.x + 10;
  const my = r.y + r.h - 13;
  ctx.fillStyle = PALETTE.meterBg;
  roundRect(ctx, mx, my, meterW, 6, 3);
  ctx.fill();
  const zStart = mx + meterW * (COOK.perfectFrom / COOK.meterMax);
  const zEnd = mx + meterW * (COOK.overdoneFrom / COOK.meterMax);
  ctx.fillStyle = 'rgba(95,168,58,0.4)';
  ctx.fillRect(zStart, my, zEnd - zStart, 6);
  const grade = gradeOf(dog.cook);
  ctx.fillStyle = grade === 'perfect' ? PALETTE.meterPerfect : grade === 'good' ? PALETTE.meterRaw : PALETTE.meterBurnt;
  roundRect(ctx, mx, my, meterW * Math.min(1, dog.cook / COOK.meterMax), 6, 3);
  ctx.fill();
}

// ---- prep table ----
function drawPlateContents(ctx: CanvasRenderingContext2D, plate: Plate, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h - 42;
  if (plate.bun && !drawSprite(ctx, 'bun', cx - 56, cy - 8, 104, 44)) {
    ctx.fillStyle = PALETTE.bun;
    roundRect(ctx, cx - 50, cy, 94, 24, 12);
    ctx.fill();
  }
  if (plate.sausage) {
    drawSprite(ctx, 'sausageCooked', cx - 46, cy - 2, 92, 34);
    if (plate.ketchup) {
      ctx.strokeStyle = PALETTE.ketchup;
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
  }
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
  ctx.fillText('PREP TABLE — drop sausage / ketchup / drink here', BOARD.width / 2, TABLE.y - 6);
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
    const base = customerSlotRect(c.slot);
    const oy = (1 - c.appear) * -20;
    const r: Rect = { ...base, y: base.y + oy };
    ctx.globalAlpha = 0.25 + 0.75 * c.appear;
    const impatient = c.patience / c.patienceMax < 0.35;

    ctx.fillStyle = PALETTE.customerBody;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = impatient ? PALETTE.patienceLow : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.stroke();

    const key: SpriteKey = c.id % 2 === 0 ? 'customer1' : 'customer2';
    if (!drawSprite(ctx, key, r.x + 6, r.y + 8, 50, 50)) {
      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(impatient ? '😠' : '🙂', r.x + 30, r.y + 30);
    }
    if (impatient) {
      ctx.font = '16px serif';
      ctx.fillText('💢', r.x + r.w - 16, r.y + 14);
    }

    const tx = r.x + 60;
    const tw = r.w - 70;
    ctx.fillStyle = '#f7ecd9';
    roundRect(ctx, tx, r.y + 10, tw, 44, 6);
    ctx.fill();
    ctx.fillStyle = '#241712';
    drawOrderIcons(ctx, c.order, tx + tw / 2, r.y + 25);
    ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(orderText(c.order), tx + tw / 2, r.y + 46);

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
  kind: 'sausage' | 'plate' | 'ketchup' | 'drink';
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
  } else if (drag.kind === 'ketchup') {
    drawKetchupIcon(ctx, x, y - 14);
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
