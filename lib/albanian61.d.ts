import { PoolBallId } from './poolShotInput.js';

export const ALBANIAN_61_TARGET: 61;
export type Albanian61Seat = 'A' | 'B';
export type Albanian61State = {
  ballsOnTable: Set<number>;
  currentPlayer: Albanian61Seat;
  scores: { A: number; B: number };
  ballInHand: boolean;
  mustPlayFromBaulk: boolean;
  frameOver: boolean;
  winner: Albanian61Seat | null;
  breakInProgress: boolean;
  lastScorer: Albanian61Seat | null;
  tieBreakBonus: Albanian61Seat | null;
};
export type Albanian61Shot = {
  contactOrder?: PoolBallId[];
  potted?: PoolBallId[];
  offTable?: PoolBallId[];
  cueOffTable?: boolean;
  foulReason?: string;
  noCushionAfterContact?: boolean;
  objectBallsToRailAfterContact?: PoolBallId[];
  railContactsAfterFirstHit?: number;
};
export class Albanian61 {
  state: Albanian61State;
  shotTaken(shot?: Albanian61Shot): {
    legal: boolean;
    foul: boolean;
    reason?: string;
    potted: number[];
    points: number;
    nextPlayer: Albanian61Seat;
    ballInHandNext: boolean;
    frameOver: boolean;
    winner: Albanian61Seat | null;
  };
}
export default Albanian61;
