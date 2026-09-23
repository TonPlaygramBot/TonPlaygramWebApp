import type { ShotState } from './poolRoyalReferenceHuman.ts';

/** Establish the address stance as soon as the table is ready for aiming.
 * Power, camera zoom and releasing the slider must not summon the shooter. */
export function resolvePoolRoyalAddressState({ stroke, ballsMoving, gameOver, ballInHand,
  cueBallPlaced = false, placingCueBall = false, breakReady = true }: {
  stroke?: { phase?: string } | null;
  ballsMoving: boolean;
  gameOver: boolean;
  ballInHand: boolean;
  /** The rules retain ball-in-hand permission until impact, after placement ends. */
  cueBallPlaced?: boolean;
  placingCueBall?: boolean;
  breakReady?: boolean;
}): ShotState {
  if (stroke) return stroke.phase === 'pullback' ? 'dragging' : 'striking';
  const placementActive = ballInHand && (placingCueBall || !cueBallPlaced);
  return ballsMoving || gameOver || placementActive || !breakReady ? 'idle' : 'dragging';
}
