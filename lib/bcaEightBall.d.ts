import { PoolBallId, PoolRuleProfile } from './poolShotInput.js';

export type BcaSeat = 'A' | 'B';
export type BcaGroup = 'SOLID' | 'STRIPE';

export type BcaEightBallState = {
  ballsOnTable: Set<number>;
  currentPlayer: BcaSeat;
  assignments: { A: BcaGroup | null; B: BcaGroup | null };
  ballInHand: boolean;
  mustPlayFromBaulk?: boolean;
  frameOver: boolean;
  winner: BcaSeat | null;
  breakInProgress: boolean;
};

export type BcaShotInput = {
  contactOrder?: PoolBallId[];
  potted?: PoolBallId[];
  offTable?: PoolBallId[];
  calledBallId?: PoolBallId;
  calledPocket?: string;
  pottedPockets?: Record<number, string>;
  safety?: boolean;
  cueOffTable?: boolean;
  foulReason?: string;
  noCushionAfterContact?: boolean;
  placedFromHand?: boolean;
  objectBallsToRailAfterContact?: PoolBallId[];
  railContactsAfterFirstHit?: number;
};

export type BcaShotResult = {
  legal: boolean;
  foul: boolean;
  reason?: string;
  potted: number[];
  nextPlayer: BcaSeat;
  ballInHandNext: boolean;
  frameOver: boolean;
  winner: BcaSeat | null;
};

export class BcaEightBall {
  state: BcaEightBallState;
  readonly profile: PoolRuleProfile;
  constructor(options?: { profile?: PoolRuleProfile });
  shotTaken(shot?: BcaShotInput): BcaShotResult;
}

export default BcaEightBall;
