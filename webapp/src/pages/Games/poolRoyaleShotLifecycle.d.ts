import type { FrameState, ShotContext } from '../../../../src/types';

type PoolBall = { id: string | number; active: boolean };
type Point = { x: number; y: number };
export function isPoolRoyalBreak(frame?: FrameState | null): boolean;
export function poolRoyalBallInHand(frame?: FrameState | null): boolean;
export function poolRoyalBallNumber(id: unknown): number | null;
export function poolRoyalBallsToSpot<T extends PoolBall>(balls: T[], frame: FrameState): T[];
export function recordPoolRoyalRail(context: ShotContext, id: string | number): void;
export function findPoolRoyalSpot(balls: (PoolBall & { pos: Point })[], id: string | number,
  options: { x?: number; y: number; minY: number; maxY: number; radius: number }): Point | null;
