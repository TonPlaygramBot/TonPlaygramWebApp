import { PoolBallId, PoolRuleProfile } from './poolShotInput.js';

export type NineBallSeat = 'A' | 'B';
export type NineBallState = {
  ballsOnTable: Set<number>;
  currentPlayer: NineBallSeat;
  ballInHand: boolean;
  gameOver: boolean;
  winner: NineBallSeat | null;
  foulStreak: { A: number; B: number };
  breakInProgress: boolean;
  pushOutAvailable?: boolean;
  pushOutPending?: { shooter: NineBallSeat; chooser: NineBallSeat } | null;
};
export type NineBallShot = {
  contactOrder?: PoolBallId[];
  potted?: PoolBallId[];
  offTable?: PoolBallId[];
  pushOut?: boolean;
  cueOffTable?: boolean;
  foulReason?: string;
  placedFromHand?: boolean;
  noCushionAfterContact?: boolean;
  objectBallsToRailAfterContact?: PoolBallId[];
  railContactsAfterFirstHit?: number;
};
export type NineBallResult = {
  legal: boolean;
  foul: boolean;
  reason?: string;
  potted: number[];
  nextPlayer: NineBallSeat;
  ballInHandNext: boolean;
  frameOver: boolean;
  winner: NineBallSeat | null;
};
export class NineBall {
  constructor(options?: { profile?: PoolRuleProfile });
  readonly profile: PoolRuleProfile;
  state: NineBallState;
  shotTaken(shot?: NineBallShot): NineBallResult;
  resolvePushOut(choice: 'accept' | 'return'): boolean;
}
export default NineBall;
