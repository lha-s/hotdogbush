import { PALETTE } from './constants.ts';
import { STATION_RECTS, customerSlotRect, grillSlotRect, targetAt } from './geometry.ts';
import type { Rect } from './geometry.ts';
import {
  collectToken,
  createState,
  serveCustomer,
  startGame,
  step,
  tapGrill,
  tokenAt,
  useStation,
} from './logic.ts';
import { render } from './render.ts';
import type { GameState, ServeFx, Station } from './types.ts';

export interface EngineHooks {
  onHud(state: GameState): void;
  onGameOver(finalCash: number, served: number): void;
}

const STATION_LABEL: Record<Station, string> = {
  bun: '+ bun',
  ketchup: '+ ketchup',
  drink: '+ drink',
  trash: 'trashed',
};

export class Engine {
  private ctx: CanvasRenderingContext2D;
  private state: GameState = createState();
  private fx: ServeFx[] = [];
  private raf = 0;
  private last = 0;
  private hooks: EngineHooks;

  constructor(
    private canvas: HTMLCanvasElement,
    hooks: EngineHooks,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.hooks = hooks;
    canvas.addEventListener('pointerdown', this.onPointer);
  }

  get phase() {
    return this.state.phase;
  }

  start(): void {
    startGame(this.state);
    this.fx = [];
    this.hooks.onHud(this.state);
    this.render();
  }

  private toBoard(ev: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * this.canvas.width;
    const y = ((ev.clientY - rect.top) / rect.height) * this.canvas.height;
    return { x, y };
  }

  private fxAt(r: Rect, text: string, color: string): void {
    this.fx.push({ x: r.x + r.w / 2, y: r.y - 4, text, color, life: 1 });
  }

  private onPointer = (ev: PointerEvent): void => {
    if (this.state.phase !== 'playing') return;
    ev.preventDefault();
    const { x, y } = this.toBoard(ev);

    // 1) cash tokens (drawn on top, collected first)
    const token = tokenAt(this.state, x, y);
    if (token) {
      const amt = collectToken(this.state, token.id);
      this.fx.push({ x: token.x, y: token.y, text: `+$${amt}`, color: PALETTE.cash, life: 1.1 });
      this.hooks.onHud(this.state);
      return;
    }

    const target = targetAt(x, y);
    if (!target) return;

    if (target.kind === 'grill') {
      const res = tapGrill(this.state, target.slot);
      const r = grillSlotRect(target.slot);
      if (res === 'tossed') this.fxAt(r, 'trashed', PALETTE.meterBurnt);
      else if (res === 'plated') this.fxAt(r, '+ dog', PALETTE.meterPerfect);
      else if (res === 'need-bun') this.fxAt(r, 'grab a bun!', PALETTE.meterRaw);
    } else if (target.kind === 'customer') {
      const res = serveCustomer(this.state, target.slot);
      const r = customerSlotRect(target.slot);
      if (res.reason === 'served') this.fxAt(r, `ORDER UP! +$${res.payout}`, PALETTE.cash);
      else if (res.reason === 'wrong-order') this.fxAt(r, 'WRONG ORDER', PALETTE.meterBurnt);
      else if (res.reason === 'empty-plate') this.fxAt(r, 'build it first', PALETTE.meterRaw);
    } else if (target.kind === 'station') {
      const res = useStation(this.state, target.station);
      if (res === 'ok') this.fxAt(STATION_RECTS[target.station], STATION_LABEL[target.station], PALETTE.text);
    }

    this.hooks.onHud(this.state);
  };

  loop = (ts: number): void => {
    if (!this.last) this.last = ts;
    const dt = Math.min(0.05, (ts - this.last) / 1000); // clamp to avoid tab-switch jumps
    this.last = ts;

    if (this.state.phase === 'playing') {
      step(this.state, dt);
      this.hooks.onHud(this.state);
      // step() may flip phase to 'gameover'; read it via the engine API (not the narrowed literal).
      if (this.phase === 'gameover') {
        this.hooks.onGameOver(this.state.cash, this.state.served);
      }
    }

    for (const f of this.fx) {
      f.life -= dt * 1.3;
      f.y -= dt * 26;
    }
    this.fx = this.fx.filter((f) => f.life > 0);

    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private render(): void {
    render(this.ctx, this.state, this.fx);
  }

  run(): void {
    cancelAnimationFrame(this.raf);
    this.last = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onPointer);
  }
}
