export type GameAction = {
  id: string;
  label: string;
  cell?: number;
  route?: number;
  card?: number;
  source?: number;
  color?: number;
  row?: number;
};
export type Card = {
  id: number;
  name: string;
  color: number;
  points: number;
  cost: number[];
};
export type Player = {
  id: string;
  name: string;
  score: number;
  cash: number;
  position: number;
  out: boolean;
  resources: number[];
  gems: number[];
  bonuses: number[];
  reserved: Card[];
  wall: boolean[][];
  rows: { color: number; count: number }[];
  contracts?: { a: number; b: number; done: boolean }[];
};
export type GameView = {
  gameId: string;
  turn: number;
  round: number;
  revision: number;
  phase: string;
  done: boolean;
  winnerAccountId: string;
  reason?: string;
  log: string[];
  players: Player[];
  values: number[];
  actions: GameAction[];
  dice?: number[];
  auction?: {
    seat: number;
    cell: number;
    bid: number;
    high: number;
    passed: number[];
  };
  board?: {
    name: string;
    owner: number;
    level: number;
    kind?: string;
    price?: number;
    district?: number;
    resource?: number;
    number?: number;
  }[];
  routes?: {
    a: number;
    b: number;
    length: number;
    color: number;
    owner: number;
  }[];
  factories?: number[][];
  center?: number[];
  market?: Card[];
  bank?: number[];
  tableId?: string;
  status?: string;
  turnDeadline?: number;
  serverNow?: number;
  connected?: Record<string, boolean>;
  stake?: number;
  settlement?: {
    status: string;
    amount?: number;
    winnerAccountId?: string;
    reason?: string;
  };
};
export interface GameSession {
  localId: string;
  subscribe(fn: (s: GameView) => void): () => void;
  act(actionId: string, revision: number): Promise<void>;
  dispose(): void;
  leave?(): void;
}
