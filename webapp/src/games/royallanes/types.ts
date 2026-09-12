export type Shot = { aim: number; hook: number; power: number };
export type GameScore = { frames: number[][]; finished: boolean };
export type BowlerState = {
  id: string;
  name: string;
  score: GameScore;
  total: number;
  standing: number[];
};
export type RollReplay = {
  events?: { time: number; strength: number; x: number; z: number }[];
  ids: number[];
  hz: number;
  stride: number;
  frames: number[][];
  standing: number[];
  knocked: number;
  gutter: boolean;
  durationMs: number;
  input: Shot;
};
export type MatchView = {
  tableId?: string;
  players: BowlerState[];
  activeId: string;
  turnId: number;
  phase:
    | 'waiting'
    | 'countdown'
    | 'aiming'
    | 'calculating'
    | 'rolling'
    | 'result'
    | 'finished';
  roll: {
    id: number;
    actorId: string;
    startsAt: number;
    releaseAt: number;
    endsAt: number;
    replay: RollReplay;
    timedOut: boolean;
  } | null;
  lastResult: {
    actorId: string;
    knocked: number;
    title: string;
    standing: number[];
    gutter: boolean;
    timedOut?: boolean;
  } | null;
  winnerAccountId: string;
  reason: string;
  turnDeadline: number;
  startsAt: number;
  serverNow: number;
  connected?: Record<string, boolean>;
  settlement?: {
    status: string;
    amount?: number;
    winnerAccountId?: string;
    reason?: string;
  } | null;
};
export interface BowlingSession {
  localId: string;
  roll(shot: Shot, turnId: number): Promise<void>;
  subscribe(listener: (state: MatchView) => void): () => void;
  setPaused?(paused: boolean): void;
  dispose(): void;
  leave?(): void;
}
