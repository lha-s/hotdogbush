export type GamePhase = 'start' | 'playing' | 'gameover';

export type DogState = 'cooking' | 'burnt';

export interface Dog {
  id: number;
  slot: number;
  cook: number; // 0..~1.1, fraction of COOK.fullTime traversed
  state: DogState;
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
  cash: number;
  served: number;
  lives: number;
  combo: number;
  dogs: Dog[];
  customers: Customer[];
  nextDogId: number;
  nextCustomerId: number;
  spawnTimer: number;
}

export type Grade = 'perfect' | 'good' | 'edge' | 'reject';

export interface ServeFx {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number; // seconds remaining
}
