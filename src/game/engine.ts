import { PALETTE } from './constants.ts';
import { targetAt } from './geometry.ts';
import {
  collectToken,
  createState,
  dropDrink,
  dropKetchup,
  dropSausageOnPlate,
  placeBun,
  servePlate,
  startGame,
  step,
  tapGrill,
  tokenAt,
  trashPlate,
  trashSausage,
} from './logic.ts';
import { render } from './render.ts';
import type { GameState, ServeFx } from './types.ts';

export interface EngineHooks {
  onHud(state: GameState): void;
  onGameOver(finalCash: number, served: number): void;
}

const DRAG_THRESHOLD = 8; // board px before a press becomes a drag

export type DragKind = 'sausage' | 'plate' | 'ketchup' | 'drink';
export interface DragState {
  kind: DragKind;
  x: number;
  y: number;
  dogId?: number;
  slot?: number;
}

interface PressState {
  x: number;
  y: number;
  source: DragState | null;
}

export class Engine {
  private ctx: CanvasRenderingContext2D;
  private state: GameState = createState();
  private fx: ServeFx[] = [];
  private raf = 0;
  private last = 0;
  private hooks: EngineHooks;
  private press: PressState | null = null;
  private drag: DragState | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    hooks: EngineHooks,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.hooks = hooks;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
  }

  get phase() {
    return this.state.phase;
  }

  start(): void {
    startGame(this.state);
    this.fx = [];
    this.press = null;
    this.drag = null;
    this.hooks.onHud(this.state);
    this.render();
  }

  private toBoard(ev: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((ev.clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }

  private pushFx(x: number, y: number, text: string, color: string): void {
    this.fx.push({ x, y, text, color, life: 1 });
  }

  // ---- pointer down: collect cash, or start a press that may become a drag ----
  private onDown = (ev: PointerEvent): void => {
    if (this.state.phase !== 'playing') return;
    ev.preventDefault();
    const { x, y } = this.toBoard(ev);

    const token = tokenAt(this.state, x, y);
    if (token) {
      const amt = collectToken(this.state, token.id);
      this.pushFx(token.x, token.y, `+$${amt}`, PALETTE.cash);
      this.hooks.onHud(this.state);
      return;
    }

    this.canvas.setPointerCapture(ev.pointerId);
    this.press = { x, y, source: this.dragSourceAt(x, y) };
  };

  /** What, if anything, can be picked up at this point. */
  private dragSourceAt(x: number, y: number): DragState | null {
    const t = targetAt(x, y);
    if (!t) return null;
    if (t.kind === 'grill') {
      const dog = this.state.dogs.find((d) => d.slot === t.slot);
      if (dog && dog.cook < 21) return { kind: 'sausage', x, y, dogId: dog.id }; // burnt handled by tap-toss
      return null;
    }
    if (t.kind === 'table') {
      const plate = this.state.plates[t.slot];
      if (plate) return { kind: 'plate', x, y, slot: t.slot };
      return null;
    }
    if (t.kind === 'station') {
      if (t.station === 'ketchup') return { kind: 'ketchup', x, y };
      if (t.station === 'drink') return { kind: 'drink', x, y };
    }
    return null;
  }

  private onMove = (ev: PointerEvent): void => {
    if (!this.press) return;
    const { x, y } = this.toBoard(ev);
    if (this.drag) {
      this.drag.x = x;
      this.drag.y = y;
    } else if (this.press.source) {
      const dist = Math.hypot(x - this.press.x, y - this.press.y);
      if (dist > DRAG_THRESHOLD) this.drag = { ...this.press.source, x, y };
    }
  };

  private onUp = (ev: PointerEvent): void => {
    if (this.state.phase !== 'playing' || !this.press) {
      this.press = null;
      this.drag = null;
      return;
    }
    const { x, y } = this.toBoard(ev);
    if (this.drag) this.resolveDrop(x, y);
    else this.resolveTap(this.press.x, this.press.y);
    this.press = null;
    this.drag = null;
    this.hooks.onHud(this.state);
  };

  private resolveDrop(x: number, y: number): void {
    const drag = this.drag!;
    const t = targetAt(x, y);
    const onTrash = t?.kind === 'station' && t.station === 'trash';

    if (drag.kind === 'sausage' && drag.dogId != null) {
      if (onTrash) {
        if (trashSausage(this.state, drag.dogId)) this.pushFx(x, y, 'trashed', PALETTE.meterBurnt);
      } else if (t?.kind === 'table') {
        const res = dropSausageOnPlate(this.state, drag.dogId, t.slot);
        if (res === 'ok') this.pushFx(x, y, 'on the bun', PALETTE.meterPerfect);
        else if (res === 'need-bun') this.pushFx(x, y, 'needs a bun', PALETTE.meterRaw);
        else if (res === 'busy') this.pushFx(x, y, 'bun full', PALETTE.meterRaw);
      }
    } else if (drag.kind === 'plate' && drag.slot != null) {
      if (onTrash) {
        if (trashPlate(this.state, drag.slot)) this.pushFx(x, y, 'trashed', PALETTE.meterBurnt);
      } else if (t?.kind === 'customer') {
        const res = servePlate(this.state, drag.slot, t.slot);
        if (res.reason === 'served') this.pushFx(x, y, `ORDER UP! +$${res.payout}`, PALETTE.cash);
        else if (res.reason === 'wrong-order') this.pushFx(x, y, 'WRONG ORDER', PALETTE.meterBurnt);
        else if (res.reason === 'empty-plate') this.pushFx(x, y, 'nothing on it', PALETTE.meterRaw);
      }
    } else if (drag.kind === 'ketchup' && t?.kind === 'table') {
      if (dropKetchup(this.state, t.slot)) this.pushFx(x, y, '+ ketchup', PALETTE.ketchup);
    } else if (drag.kind === 'drink' && t?.kind === 'table') {
      if (dropDrink(this.state, t.slot)) this.pushFx(x, y, '+ drink', PALETTE.drink);
    }
  }

  private resolveTap(x: number, y: number): void {
    const t = targetAt(x, y);
    if (!t) return;
    if (t.kind === 'grill') {
      const res = tapGrill(this.state, t.slot);
      if (res === 'tossed') this.pushFx(x, y, 'trashed', PALETTE.meterBurnt);
    } else if (t.kind === 'station' && t.station === 'bun') {
      if (placeBun(this.state) !== -1) this.pushFx(x, y, '+ bun', PALETTE.text);
    }
  }

  loop = (ts: number): void => {
    if (!this.last) this.last = ts;
    const dt = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts;

    if (this.state.phase === 'playing') {
      step(this.state, dt);
      this.hooks.onHud(this.state);
      if (this.phase === 'gameover') this.hooks.onGameOver(this.state.cash, this.state.served);
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
    render(this.ctx, this.state, this.fx, this.drag);
  }

  run(): void {
    cancelAnimationFrame(this.raf);
    this.last = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
  }
}
