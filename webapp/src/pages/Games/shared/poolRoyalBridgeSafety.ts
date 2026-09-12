import * as THREE from 'three';

export type BridgeObstacle = { position: THREE.Vector3; radius: number };
export type BridgeBounds = { halfWidth: number; halfLength: number };

export type SafeBridgeResult = {
  anchor: THREE.Vector3;
  style: 'open' | 'compact' | 'raised';
};

/**
 * Finds a planted-hand position without putting the palm through a ball or a
 * cushion. Candidates remain behind the cue ball, so the hand cannot cross the
 * strike line. Clamping to the playable rectangle permits cushion contact but
 * never overlap.
 */
export function resolveSafeBridgeAnchor(
  preferred: THREE.Vector3,
  forwardInput: THREE.Vector3,
  obstacles: BridgeObstacle[],
  bounds: BridgeBounds,
  handRadius: number
): SafeBridgeResult {
  const forward = forwardInput.clone().setY(0);
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
  else forward.normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x);
  const insetX = Math.max(0, bounds.halfWidth - handRadius);
  const insetZ = Math.max(0, bounds.halfLength - handRadius);
  const clampToCloth = (point: THREE.Vector3) => point.set(
    THREE.MathUtils.clamp(point.x, -insetX, insetX),
    preferred.y,
    THREE.MathUtils.clamp(point.z, -insetZ, insetZ)
  );
  const isClear = (point: THREE.Vector3) => obstacles.every(({ position, radius }) => {
    const dx = point.x - position.x;
    const dz = point.z - position.z;
    return dx * dx + dz * dz >= (handRadius + radius) ** 2;
  });

  const lateralSteps = [0, 0.75, -0.75, 1.5, -1.5, 2.25, -2.25];
  const rearSteps = [0, 0.65, 1.3, 2];
  for (const rear of rearSteps) for (const lateral of lateralSteps) {
    const candidate = clampToCloth(preferred.clone()
      .addScaledVector(forward, -rear * handRadius)
      .addScaledVector(side, lateral * handRadius));
    if (isClear(candidate)) {
      const moved = candidate.distanceToSquared(preferred) > handRadius * handRadius * 0.2;
      return { anchor: candidate, style: moved ? 'compact' : 'open' };
    }
  }

  // A crowded rail shot uses a raised bridge: retain a legal cloth footprint
  // while the pose solver lifts/curls the fingers above nearby balls.
  return { anchor: clampToCloth(preferred.clone()), style: 'raised' };
}
