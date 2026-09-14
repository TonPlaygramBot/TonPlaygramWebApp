export type PoolRuleProfile = 'standard' | 'reference';
export type PoolBallId = number | string;
export function normalizePoolBallId(value: unknown, maxBall?: number): number | null;
export function normalizePoolPots(values: unknown, ballsOnTable: Set<number>, maxBall: number): number[];
export function countPoolBreakObjectRails(shot: {
  objectBallsToRailAfterContact?: PoolBallId[];
  railContactsAfterFirstHit?: number;
}, ballsOnTable: Set<number>, maxBall: number): number;
export function poolShotHasNoCushion(context: {
  noCushionAfterContact?: boolean;
  cushionAfterContact?: boolean;
  railContactCountAfterContact?: number;
}): boolean;
