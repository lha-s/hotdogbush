import { sprite, type SpriteKey } from './assets.ts';
import { BOARD, CASH, COOK, GRILL, PALETTE } from './constants.ts';
import { PLATE_RECT, STATION_RECTS, customerSlotRect, grillSlotRect } from './geometry.ts';
import type { Rect } from './geometry.ts';
import { gradeOf, isBurnt } from './logic.ts';
import type { Dog, GameState, Order, Plate, ServeFx, Station } from './types.ts';

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
// Background
// ---------------------------------------------------------------------------
function drawBackground(ctx: CanvasRenderingContext2D): void {
  if (!drawSprite(ctx, 'bg', 0, 0, BOARD.width, BOARD.height)) {
    ctx.fillStyle = '#181009';
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  }
  // counter band behind the working area
  ctx.fillStyle = 'rgba(20,14,9,0.78)';
  ctx.fillRect(0, GRILL.y - 24, BOARD.width, BOARD.height - GRILL.y + 24);
}

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------
function drawStationBox(ctx: CanvasRenderingContext2D, r: Rect, label: string, active: boolean): void {
  ctx.fillStyle = active ? PALETTE.stationActive : PALETTE.station;
  roundRect(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.fill();
  ctx.strokeStyle = active ? PALETTE.mustard : 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 3;
  roundRect(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 13px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h - 8);
}

function drawBunIcon(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + 30;
  if (!drawSprite(ctx, 'bun', cx - 44, cy - 14, 88, 38)) {
    ctx.fillStyle = PALETTE.bun;
    roundRect(ctx, cx - 40, cy - 10, 80, 22, 11);
    ctx.fill();
  }
}

function drawKetchupIcon(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + 16;
  ctx.fillStyle = PALETTE.ketchup;
  roundRect(ctx, cx - 9, cy, 18, 30, 7);
  ctx.fill();
  ctx.fillStyle = '#7a1d13';
  roundRect(ctx, cx - 5, cy - 8, 10, 9, 3);
  ctx.fill();
}

function drawDrinkIcon(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + 10;
  ctx.fillStyle = '#dfe6ec';
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy);
  ctx.lineTo(cx + 13, cy);
  ctx.lineTo(cx + 9, cy + 34);
  ctx.lineTo(cx - 9, cy + 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.drink;
  ctx.fillRect(cx - 11, cy + 4, 22, 12);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy - 8);
  ctx.lineTo(cx + 7, cy + 30);
  ctx.stroke();
}

function drawTrashIcon(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + 10;
  ctx.fillStyle = '#5a5550';
  roundRect(ctx, cx - 14, cy, 28, 34, 4);
  ctx.fill();
  ctx.fillStyle = '#74706a';
  roundRect(ctx, cx - 18, cy - 6, 36, 8, 3);
  ctx.fill();
  ctx.strokeStyle = '#2a2824';
  ctx.lineWidth = 2;
  for (const dx of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy + 6);
    ctx.lineTo(cx + dx, cy + 28);
    ctx.stroke();
  }
}

function drawStations(ctx: CanvasRenderingContext2D, state: GameState): void {
  const p = state.plate;
  const can: Record<Station, boolean> = {
    bun: !p,
    ketchup: !!p && p.sausage !== null && !p.ketchup,
    drink: !p || !p.drink,
    trash: true,
  };
  drawStationBox(ctx, STATION_RECTS.bun, 'Bun', can.bun);
  drawBunIcon(ctx, STATION_RECTS.bun);
  drawStationBox(ctx, STATION_RECTS.ketchup, 'Ketchup', can.ketchup);
  drawKetchupIcon(ctx, STATION_RECTS.ketchup);
  drawStationBox(ctx, STATION_RECTS.drink, 'Drink', can.drink);
  drawDrinkIcon(ctx, STATION_RECTS.drink);
  drawStationBox(ctx, STATION_RECTS.trash, 'Trash', false);
  drawTrashIcon(ctx, STATION_RECTS.trash);
}

// ---------------------------------------------------------------------------
// Grill
// ---------------------------------------------------------------------------
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
}

function drawDog(ctx: CanvasRenderingContext2D, dog: Dog, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 - 4;
  const sw = 96;
  const sh = (sw * 44) / 120;
  drawSprite(ctx, sausageKeyFor(dog), cx - sw / 2, cy - sh / 2, sw, sh);

  if (isBurnt(dog.cook)) {
    ctx.fillStyle = PALETTE.ember;
    ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔥 burnt — trash it', cx, r.y + r.h - 11);
    return;
  }

  const meterW = r.w - 20;
  const mx = r.x + 10;
  const my = r.y + r.h - 12;
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

// ---------------------------------------------------------------------------
// Plate (assembly)
// ---------------------------------------------------------------------------
function drawPlate(ctx: CanvasRenderingContext2D, plate: Plate | null): void {
  const r = PLATE_RECT;
  // plate dish
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fill();
  ctx.fillStyle = PALETTE.plate;
  ctx.beginPath();
  ctx.ellipse(r.x + r.w / 2, r.y + r.h - 26, r.w / 2 - 8, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('PLATE', r.x + r.w / 2, r.y + 4);

  if (!plate || (plate.sausage === null && !plate.drink && !plate.ketchup && !plate.bun)) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'italic 12px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('assemble here', r.x + r.w / 2, r.y + r.h / 2);
    return;
  }

  const cx = r.x + r.w / 2;
  const cy = r.y + r.h - 40;
  if (plate.bun) {
    if (!drawSprite(ctx, 'bun', cx - 56, cy - 6, 100, 44)) {
      ctx.fillStyle = PALETTE.bun;
      roundRect(ctx, cx - 50, cy, 90, 24, 12);
      ctx.fill();
    }
  }
  if (plate.sausage) {
    drawSprite(ctx, 'sausageCooked', cx - 44, cy - 2, 88, 32);
    if (plate.ketchup) {
      ctx.strokeStyle = PALETTE.ketchup;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const px = cx - 36 + i * 12;
        const py = cy + 6 + (i % 2 === 0 ? -4 : 4);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  if (plate.drink) {
    drawDrinkIcon(ctx, { x: r.x + r.w - 30, y: r.y + 16, w: 0, h: 0 });
  }
}

// ---------------------------------------------------------------------------
// Customers + order tickets
// ---------------------------------------------------------------------------
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
    const r = customerSlotRect(c.slot);
    const impatient = c.patience / c.patienceMax < 0.35;

    ctx.fillStyle = PALETTE.customerBody;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = impatient ? PALETTE.patienceLow : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.stroke();

    // face on the left
    const key: SpriteKey = c.id % 2 === 0 ? 'customer1' : 'customer2';
    if (!drawSprite(ctx, key, r.x + 6, r.y + 8, 52, 52)) {
      ctx.font = '30px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(impatient ? '😠' : '🙂', r.x + 32, r.y + 32);
    }
    if (impatient) {
      ctx.font = '16px serif';
      ctx.fillText('💢', r.x + r.w - 16, r.y + 14);
    }

    // order ticket on the right
    const tx = r.x + 64;
    ctx.fillStyle = '#f7ecd9';
    roundRect(ctx, tx, r.y + 10, r.w - 74, 46, 6);
    ctx.fill();
    ctx.fillStyle = '#241712';
    drawOrderIcons(ctx, c.order, tx + (r.w - 74) / 2, r.y + 26);
    ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(orderText(c.order), tx + (r.w - 74) / 2, r.y + 48);

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
  }
}

// ---------------------------------------------------------------------------
// Cash tokens
// ---------------------------------------------------------------------------
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
    ctx.font = '700 15px Arial Black, system-ui, sans-serif';
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

// ---------------------------------------------------------------------------
export function render(ctx: CanvasRenderingContext2D, state: GameState, fx: ServeFx[]): void {
  ctx.clearRect(0, 0, BOARD.width, BOARD.height);
  drawBackground(ctx);
  drawStations(ctx, state);
  drawGrill(ctx, state);
  drawPlate(ctx, state.plate);
  drawCustomers(ctx, state);
  drawCashTokens(ctx, state);
  drawFx(ctx, fx);

  if (state.combo >= 2) {
    ctx.fillStyle = PALETTE.meterRaw;
    ctx.font = '700 18px Arial Black, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`🔥 ${state.combo}× combo`, BOARD.width / 2, GRILL.y - 22);
  }
}
