import { PALETTE } from './constants.ts';
import { grillSlotAt, grillSlotRect } from './geometry.ts';
import { createState, serveFromSlot, startCooking, startGame, step } from './logic.ts';
import { render } from './render.ts';
import type { GameState, Grade, ServeFx } from './types.ts';

export interface EngineHooks {
  onHud(state: GameState): void;
  onGameOver(finalCash: number, served: number): void;
}

const GRADE_FX: Record<Grade, { text: string; color: string }> = {
  perfect: { text: 'PERFECT +', color: PALETTE.meterPerfect },
  good: { text: 'NICE +', color: PALETTE.meterRaw },
  edge: { text: 'OK +', color: PALETTE.muted },
  reject: { text: 'WASTED', color: PALETTE.meterBurnt },
};

export class Engine {
  private ctx: CanvasRenderingContext2D;
  private state: GameState = createState();
  private fx: ServeFx[] = [];
  private raf = 0;
  private last = 0;
  private hooks: EngineHooks;

  constructor(private canvas: HTMLCanvasElement, hooks: EngineHooks) {
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

  private onPointer = (ev: PointerEvent): void => {
    if (this.state.phase !== 'playing') return;
    ev.preventDefault();
    const { x, y } = this.toBoard(ev);
    const slot = grillSlotAt(x, y);
    if (slot === -1) return;

    const hasDog = this.state.dogs.some((d) => d.slot === slot);
    if (!hasDog) {
      startCooking(this.state, slot);
    } else {
      const result = serveFromSlot(this.state, slot);
      if (result) this.spawnFx(slot, result.grade, result.cash);
    }
    this.hooks.onHud(this.state);
  };

  private spawnFx(slot: number, grade: Grade, cash: number): void {
    const r = grillSlotRect(slot);
    const meta = GRADE_FX[grade];
    const text = cash > 0 ? `${meta.text}$${cash}` : meta.text;
    this.fx.push({ x: r.x + r.w / 2, y: r.y - 6, text, color: meta.color, life: 1 });
  }

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

    // advance fx
    for (const f of this.fx) {
      f.life -= dt * 1.4;
      f.y -= dt * 30;
    }
    this.fx = this.fx.filter((f) => f.life > 0);

    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private render(): void {
    render(this.ctx, this.state, this.fx, this.state.combo);
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
