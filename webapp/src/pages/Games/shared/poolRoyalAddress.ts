import type { ShotState } from './poolRoyalReferenceHuman.ts';

/** Establish the address stance as soon as the table is ready for aiming.
 * Power, camera zoom and releasing the slider must not summon the shooter. */
export function resolvePoolRoyalAddressState({ stroke, ballsMoving, gameOver, ballInHand, breakReady = true }: {
  stroke?: { phase?: string } | null;
  ballsMoving: boolean;
  gameOver: boolean;
  ballInHand: boolean;
  breakReady?: boolean;
}): ShotState {
  if (stroke) return stroke.phase === 'pullback' ? 'dragging' : 'striking';
  return ballsMoving || gameOver || ballInHand || !breakReady ? 'idle' : 'dragging';
}
