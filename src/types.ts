export type BallColor = 'RED'|'YELLOW'|'GREEN'|'BROWN'|'BLUE'|'PINK'|'BLACK'|'CUE';
export type PocketId = 'TL'|'TM'|'TR'|'BL'|'BM'|'BR';

export interface Ball {
  id: string;
  color: BallColor;
  onTable: boolean;
  potted: boolean;
  position?: { x:number; y:number };
}

export interface Player {
  id:string;
  name:string;
  score:number;
  highestBreak?:number;
}
export type Phase = 'OPENING'|'REDS_AND_COLORS'|'COLORS_ORDER';

export interface FrameState {
  balls: Ball[];
  activePlayer: 'A'|'B';
  players: { A:Player; B:Player };
  currentBreak?: number;
  phase: Phase;
  redsRemaining: number;
  colorOnAfterRed?: boolean;
  ballOn: (BallColor|string)[];
  foul?: { points:number; reason:string };
  freeBall?: boolean;
  frameOver: boolean;
  winner?: 'A'|'B'|'TIE';
  meta?: Record<string, unknown>;
}

export type ShotEvent =
  | { type:'HIT'; firstContact:BallColor|string|number|null; ballId?:string|number|null }
  | { type:'POTTED'; ball:BallColor|string|number; pocket:PocketId; ballId?:string|number|null }
  | { type:'FOUL'; reason:string; ball?:BallColor }
  | { type:'END_TURN' };

export interface ShotContext {
  placedFromHand?: boolean;
  cueBallPotted?: boolean;
  contactMade?: boolean;
  cushionAfterContact?: boolean;
  noCushionAfterContact?: boolean;
  nominatedBall?: BallColor|string;
  declaredBall?: BallColor|string;
  freeBall?: boolean;
  snookered?: boolean;
  variant?: string;
  simulated?: boolean;
}
