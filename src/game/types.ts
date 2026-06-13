export type GamePhase = 'start' | 'playing' | 'gameover';

export type Grade = 'perfect' | 'good' | 'overdone';

export interface Dog {
  id: number;
  slot: number;
  cook: number; // seconds of grill time elapsed
}

/** What a customer wants. Mirrors the original's Order(Sausage, Ketchup, Glass) combos. */
export interface Order {
  sausage: boolean;
  ketchup: boolean;
  drink: boolean;
}

/** A single build on the prep table. */
export interface Plate {
  bun: boolean;
  sausage: Grade | null;
  ketchup: boolean;
  drink: boolean;
}

export interface Customer {
  id: number;
  slot: number;
  order: Order;
  patience: number; // seconds remaining
  patienceMax: number;
  served: boolean;
  leaving: boolean;
  appear: number; // 0..1 entrance animation progress
}

/** Cash that lands on the counter after a serve; tap to collect before it disappears. */
export interface CashToken {
  id: number;
  amount: number;
  x: number;
  y: number;
  life: number; // seconds remaining before it vanishes
}

export interface GameState {
  phase: GamePhase;
  elapsed: number;
  timeLeft: number; // seconds left in the 90s shift
  cash: number; // collected cash = leaderboard score
  pending: number; // cash sitting on the counter, not yet collected
  served: number;
  missed: number; // customers who walked off
  wrong: number; // wrong orders handed over
  combo: number;
  dogs: Dog[];
  customers: Customer[];
  plates: (Plate | null)[]; // prep table: one entry per TABLE.slots
  activePlate: number; // index of the plate being topped, or -1
  cashTokens: CashToken[];
  nextDogId: number;
  nextCustomerId: number;
  nextTokenId: number;
  spawnTimer: number;
}

export type Station = 'bun' | 'ketchup' | 'drink' | 'trash';

export interface ServeFx {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number; // seconds remaining
}
