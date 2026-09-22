export interface SnookerVisibilityBall {
  id?: string | number;
  color?: string | number;
  colour?: string;
  pos?: { x: number; y: number };
  position?: { x: number; y: number };
  x?: number;
  y?: number;
  radius?: number;
  active?: boolean;
  onTable?: boolean;
  potted?: boolean;
}

export function isSnookerObstructed(options: {
  cue: SnookerVisibilityBall;
  balls: SnookerVisibilityBall[];
  ballOn: string[];
  ballRadius: number;
  ballInHand?: boolean;
}): boolean;
