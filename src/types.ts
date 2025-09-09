export type BallColor = 'RED'|'YELLOW'|'GREEN'|'BROWN'|'BLUE'|'PINK'|'BLACK'|'CUE';

export interface Ball {
  id: string;
  color: BallColor;
  onTable: boolean;
  potted: boolean;
}

export interface Player { id:string; name:string; score:number; }
export type Phase = 'OPENING'|'REDS_AND_COLORS'|'COLORS_ORDER';

export interface FrameState {
  balls: Ball[];
  activePlayer: 'A'|'B';
  players: { A:Player; B:Player };
  phase: Phase;
  redsRemaining: number;
  colorOnAfterRed?: boolean;
  ballOn: BallColor[];
  foul?: { points:number; reason:string };
  freeBall?: boolean;
  frameOver: boolean;
  winner?: 'A'|'B'|'TIE';
}

export type ShotEvent =
  | { type:'HIT'; firstContact:BallColor|null }
  | { type:'POTTED'; ball:BallColor };
