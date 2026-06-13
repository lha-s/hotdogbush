export type GamePhase = 'start' | 'playing' | 'gameover';

export interface Dog {
  id: number;
  slot: number;
  cook: number; // seconds of grill time elapsed
}

export interface Customer {
  id: number;
  slot: number;
  patience: number; // seconds remaining
  patienceMax: number;
  served: boolean;
  leaving: boolean;
}

export interface GameState {
  phase: GamePhase;
  elapsed: number;
  timeLeft: number; // seconds left in the 90s shift
  cash: number;
  served: number;
  missed: number; // customers who walked off
  combo: number;
  dogs: Dog[];
  customers: Customer[];
  nextDogId: number;
  nextCustomerId: number;
  spawnTimer: number;
}

export type Grade = 'perfect' | 'good' | 'overdone';

export interface ServeFx {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number; // seconds remaining
}
