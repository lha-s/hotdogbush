import { sprite, type SpriteKey } from './assets.ts';
import { BOARD, COOK, GRILL, PALETTE } from './constants.ts';
import { customerSlotRect, grillSlotRect } from './geometry.ts';
import { gradeOf } from './logic.ts';
import type { Dog, GameState, ServeFx } from './types.ts';

type Rect = { x: number; y: number; w: number; h: number };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draw a sprite fitted into a box (contain), centered. Returns false if not loaded. */
function drawSprite(ctx: CanvasRenderingContext2D, key: SpriteKey, x: number, y: number, w: number, h: number): boolean {
  const img = sprite(key);
  if (!img) return false;
  ctx.drawImage(img, x, y, w, h);
  return true;
}

function sausageKeyFor(dog: Dog): SpriteKey {
  if (dog.cook >= COOK.overdoneFrom) return 'sausageBurnt';
  return dog.cook < COOK.perfectFrom ? 'sausageRaw' : 'sausageCooked';
}

function drawGrill(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (let s = 0; s < GRILL.slots; s++) {
    const r = grillSlotRect(s);
    const dog = state.dogs.find((d) => d.slot === s);

    // slot well
    ctx.fillStyle = dog ? PALETTE.grillHot : PALETTE.grillCold;
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fill();

    // grill bars
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    for (let i = 1; i < 5; i++) {
      const gx = r.x + (r.w / 5) * i;
      ctx.beginPath();
      ctx.moveTo(gx, r.y + 6);
      ctx.lineTo(gx, r.y + r.h - 6);
      ctx.stroke();
    }

    if (dog) {
      drawDog(ctx, dog, r);
    } else {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('tap to cook', r.x + r.w / 2, r.y + r.h / 2);
    }
  }
}

function dogColor(dog: Dog): string {
  if (dog.cook < COOK.perfectFrom) return PALETTE.raw;
  if (dog.cook < COOK.overdoneFrom) return PALETTE.perfect;
  return PALETTE.burnt;
}

function drawDog(ctx: CanvasRenderingContext2D, dog: Dog, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 - 4;

  // sprite first; procedural fallback if assets haven't loaded
  const sw = 104;
  const sh = (sw * 44) / 120;
  const drawn = drawSprite(ctx, sausageKeyFor(dog), cx - sw / 2, cy - sh / 2, sw, sh);
  if (!drawn) {
    ctx.fillStyle = dogColor(dog);
    roundRect(ctx, cx - 46, cy - 11, 92, 22, 11);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, cx - 40, cy - 8, 80, 6, 3);
    ctx.fill();
  }

  // cook meter (seconds), with the 7–14s "perfect" zone highlighted in green
  const meterW = r.w - 24;
  const mx = r.x + 12;
  const my = r.y + r.h - 14;
  ctx.fillStyle = PALETTE.meterBg;
  roundRect(ctx, mx, my, meterW, 7, 3.5);
  ctx.fill();

  const zoneStart = mx + meterW * (COOK.perfectFrom / COOK.meterMax);
  const zoneEnd = mx + meterW * (COOK.overdoneFrom / COOK.meterMax);
  ctx.fillStyle = 'rgba(95,168,58,0.35)';
  ctx.fillRect(zoneStart, my, zoneEnd - zoneStart, 7);

  const grade = gradeOf(dog.cook);
  const fillFrac = Math.min(1, dog.cook / COOK.meterMax);
  ctx.fillStyle =
    grade === 'perfect' ? PALETTE.meterPerfect : grade === 'good' ? PALETTE.meterRaw : PALETTE.meterBurnt;
  roundRect(ctx, mx, my, meterW * fillFrac, 7, 3.5);
  ctx.fill();

  if (grade === 'overdone') {
    ctx.fillStyle = PALETTE.ember;
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('overdone · still sells', cx, r.y + 12);
  }
}

function drawCustomers(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const c of state.customers) {
    if (c.served) continue;
    const r = customerSlotRect(c.slot);
    const impatient = c.patience / c.patienceMax < 0.35;

    // order card
    ctx.fillStyle = PALETTE.customerBody;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = impatient ? PALETTE.patienceLow : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.stroke();

    // customer sprite (alternate two faces by id), procedural emoji fallback
    const key: SpriteKey = c.id % 2 === 0 ? 'customer1' : 'customer2';
    const cs = 56;
    const drawn = drawSprite(ctx, key, r.x + r.w / 2 - cs / 2, r.y + 6, cs, cs);
    if (!drawn) {
      ctx.font = '34px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(impatient ? '😠' : '🙂', r.x + r.w / 2, r.y + 34);
    } else if (impatient) {
      // anger mark when running out of patience
      ctx.font = '18px serif';
      ctx.fillText('💢', r.x + r.w - 22, r.y + 18);
    }

    // order
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 14px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1× hot dog 🌭', r.x + r.w / 2, r.y + 74);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('cooked, not burnt', r.x + r.w / 2, r.y + 90);

    // patience bar
    const pw = r.w - 24;
    const px = r.x + 12;
    const py = r.y + r.h - 14;
    ctx.fillStyle = '#000';
    roundRect(ctx, px, py, pw, 6, 3);
    ctx.fill();
    const frac = Math.max(0, c.patience / c.patienceMax);
    ctx.fillStyle = impatient ? PALETTE.patienceLow : PALETTE.patienceGood;
    roundRect(ctx, px, py, pw * frac, 6, 3);
    ctx.fill();
  }
}

function drawFx(ctx: CanvasRenderingContext2D, fx: ServeFx[]): void {
  for (const f of fx) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.fillStyle = f.color;
    ctx.font = '700 22px Arial Black, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  if (drawSprite(ctx, 'bg', 0, 0, BOARD.width, BOARD.height)) return;
  // procedural fallback backdrop
  ctx.fillStyle = '#181009';
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  ctx.fillStyle = '#1a120d';
  ctx.fillRect(0, GRILL.y - 26, BOARD.width, BOARD.height - GRILL.y + 26);
  ctx.fillStyle = '#0f0a07';
  ctx.fillRect(0, GRILL.y - 30, BOARD.width, 6);
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, fx: ServeFx[], combo: number): void {
  ctx.clearRect(0, 0, BOARD.width, BOARD.height);
  drawBackground(ctx);

  // condiment decor on the counter corners
  drawSprite(ctx, 'condiments', BOARD.width - 92, GRILL.y - 50, 80, 60);

  drawCustomers(ctx, state);
  drawGrill(ctx, state);
  drawFx(ctx, fx);

  if (combo >= 2) {
    ctx.fillStyle = PALETTE.meterRaw;
    ctx.font = '700 20px Arial Black, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`🔥 ${combo}× combo`, BOARD.width / 2, GRILL.y - 24);
  }
}
