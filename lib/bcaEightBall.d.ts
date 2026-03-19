export type BcaSeat = 'A' | 'B';
export type BcaGroup = 'SOLID' | 'STRIPE';

export type BcaEightBallState = {
  ballsOnTable: Set<number>;
  currentPlayer: BcaSeat;
  assignments: { A: BcaGroup | null; B: BcaGroup | null };
  ballInHand: boolean;
  frameOver: boolean;
  winner: BcaSeat | null;
  breakInProgress: boolean;
};

export type BcaShotInput = {
  contactOrder?: number[];
  potted?: number[];
  cueOffTable?: boolean;
  noCushionAfterContact?: boolean;
  placedFromHand?: boolean;
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
  constructor();
  shotTaken(shot?: BcaShotInput): BcaShotResult;
}

export default BcaEightBall;
