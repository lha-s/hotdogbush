import { BOARD, COOK, GRILL, PALETTE } from './constants.ts';
import { customerSlotRect, grillSlotRect } from './geometry.ts';
import { gradeOf } from './logic.ts';
import type { Dog, GameState, ServeFx } from './types.ts';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
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
  if (dog.state === 'burnt') return PALETTE.burnt;
  const t = dog.cook / 1;
  if (t < COOK.rawUntil) return PALETTE.raw;
  if (t <= COOK.goodTo) return PALETTE.perfect;
  return '#3a2418';
}

function drawDog(ctx: CanvasRenderingContext2D, dog: Dog, r: Rect): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 - 4;

  // sausage
  ctx.fillStyle = dogColor(dog);
  roundRect(ctx, cx - 46, cy - 11, 92, 22, 11);
  ctx.fill();
  // sheen
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, cx - 40, cy - 8, 80, 6, 3);
  ctx.fill();

  if (dog.state === 'burnt') {
    ctx.fillStyle = PALETTE.ember;
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔥 burnt — tap to toss', cx, r.y + r.h - 12);
    return;
  }

  // cook meter
  const meterW = r.w - 24;
  const mx = r.x + 12;
  const my = r.y + r.h - 14;
  ctx.fillStyle = PALETTE.meterBg;
  roundRect(ctx, mx, my, meterW, 7, 3.5);
  ctx.fill();

  // green "perfect" zone marker
  const zoneStart = mx + meterW * COOK.perfectFrom;
  const zoneEnd = mx + meterW * COOK.goodTo;
  ctx.fillStyle = 'rgba(95,168,58,0.35)';
  ctx.fillRect(zoneStart, my, zoneEnd - zoneStart, 7);

  const grade = gradeOf(dog.cook);
  const fillFrac = Math.min(1, dog.cook / COOK.burntAt);
  ctx.fillStyle =
    grade === 'perfect' ? PALETTE.meterPerfect : grade === 'reject' && dog.cook < COOK.rawUntil ? PALETTE.meterRaw : PALETTE.meterBurnt;
  roundRect(ctx, mx, my, meterW * fillFrac, 7, 3.5);
  ctx.fill();
}

type Rect = { x: number; y: number; w: number; h: number };

function drawCustomers(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const c of state.customers) {
    if (c.served) continue;
    const r = customerSlotRect(c.slot);

    // speech bubble / order card
    ctx.fillStyle = PALETTE.customerBody;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = c.patience / c.patienceMax < 0.35 ? PALETTE.patienceLow : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.stroke();

    // face
    ctx.font = '34px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const mood = c.patience / c.patienceMax < 0.35 ? '😠' : '🙂';
    ctx.fillText(mood, r.x + r.w / 2, r.y + 34);

    // order
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 14px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('1× hot dog 🌭', r.x + r.w / 2, r.y + 70);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('cooked, not burnt', r.x + r.w / 2, r.y + 88);

    // patience bar
    const pw = r.w - 24;
    const px = r.x + 12;
    const py = r.y + r.h - 14;
    ctx.fillStyle = '#000';
    roundRect(ctx, px, py, pw, 6, 3);
    ctx.fill();
    const frac = Math.max(0, c.patience / c.patienceMax);
    ctx.fillStyle = frac < 0.35 ? PALETTE.patienceLow : PALETTE.patienceGood;
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

export function render(ctx: CanvasRenderingContext2D, state: GameState, fx: ServeFx[], combo: number): void {
  ctx.clearRect(0, 0, BOARD.width, BOARD.height);

  // counter band behind the grill
  ctx.fillStyle = '#1a120d';
  ctx.fillRect(0, GRILL.y - 26, BOARD.width, BOARD.height - GRILL.y + 26);
  ctx.fillStyle = '#0f0a07';
  ctx.fillRect(0, GRILL.y - 30, BOARD.width, 6);

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
