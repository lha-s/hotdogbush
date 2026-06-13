export type GamePhase = 'start' | 'playing' | 'paused' | 'gameover';

export type Grade = 'perfect' | 'good' | 'overdone';

export type FoodKind = 'sausage' | 'patty' | 'fries' | 'onion';
export type CookStation = 'grill' | 'fryer' | 'pan';

/** One item cooking on an appliance (generalizes the old Dog). */
export interface CookItem {
  id: number;
  kind: FoodKind;
  station: CookStation;
  slot: number;
  cook: number; // seconds on the appliance
}

/** What a customer wants. Booleans = "is this item wanted". */
export interface Order {
  sausage: boolean; // hot dog
  burger: boolean;
  ketchup: boolean;
  mustard: boolean;
  drink: boolean;
  fries: boolean;
  onion: boolean;
}

/** A single build (tray) on the prep table. */
export interface Plate {
  bun: boolean; // hot-dog bun
  burgerBun: boolean;
  sausage: Grade | null;
  patty: Grade | null;
  fries: Grade | null;
  onion: boolean;
  ketchup: boolean;
  mustard: boolean;
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
  dogs: CookItem[]; // cooking items on the grill (and later fryer/pan)
  customers: Customer[];
  plates: (Plate | null)[]; // prep table: one entry per TABLE.slots
  cashTokens: CashToken[];
  nextDogId: number;
  nextCustomerId: number;
  nextTokenId: number;
  spawnTimer: number;
}

export type Station = 'bun' | 'burgerBun' | 'ketchup' | 'drink' | 'trash' | 'rawPatty';

export interface ServeFx {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number; // seconds remaining
}
