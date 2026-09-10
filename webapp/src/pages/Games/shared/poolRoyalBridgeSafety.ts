import * as THREE from 'three';

export type BridgeObstacle = { position: THREE.Vector3; radius: number };
export type BridgeBounds = { halfWidth: number; halfLength: number; cushionTopY?: number };
export type BridgeStyle = 'open' | 'compact' | 'raised' | 'rail';
export type BridgeEnvironment = { obstacles: BridgeObstacle[]; bounds: BridgeBounds; clothY?: number };

/** All boxes contain posed skin triangles, including the webbing between fingers. */
export function bridgeIsClear(parts: THREE.Box3[], environment: BridgeEnvironment,
  clearance: number, offset = new THREE.Vector3()) {
  const { bounds, obstacles } = environment;
  const box = new THREE.Box3();
  for (const part of parts) {
    box.copy(part).translate(offset);
    if (environment.clothY !== undefined && box.min.y < environment.clothY) return false;
    if ((box.min.x < -bounds.halfWidth + clearance || box.max.x > bounds.halfWidth - clearance ||
      box.min.z < -bounds.halfLength + clearance || box.max.z > bounds.halfLength - clearance) &&
      box.min.y < (bounds.cushionTopY ?? Infinity) + clearance) return false;
    if (obstacles.some(ball => box.distanceToPoint(ball.position) < ball.radius + clearance)) return false;
  }
  return true;
}

/** Search along the shaft. Never clamp toward/across the cue ball or move the cue channel sideways. */
export function findBridgeRetraction(parts: THREE.Box3[], forward: THREE.Vector3,
  environment: BridgeEnvironment, clearance: number, maxDistance: number) {
  const offset = new THREE.Vector3();
  for (let step = 0; step <= 12; step++) {
    offset.copy(forward).multiplyScalar(-maxDistance * step / 12);
    if (bridgeIsClear(parts, environment, clearance, offset)) return offset.clone();
  }
  return null;
}

/** Minimum vertical translation that clears both balls and the cushion volume. */
export function bridgeRequiredLift(parts: THREE.Box3[], environment: BridgeEnvironment, clearance: number) {
  let lift = 0;
  const { bounds, obstacles } = environment;
  for (const box of parts) {
    if (environment.clothY !== undefined) lift = Math.max(lift, environment.clothY + clearance - box.min.y);
    if (box.min.x < -bounds.halfWidth + clearance || box.max.x > bounds.halfWidth - clearance ||
      box.min.z < -bounds.halfLength + clearance || box.max.z > bounds.halfLength - clearance) {
      lift = Math.max(lift, (bounds.cushionTopY ?? box.min.y) + clearance - box.min.y);
    }
    for (const ball of obstacles) {
      const dx = Math.max(box.min.x - ball.position.x, 0, ball.position.x - box.max.x);
      const dz = Math.max(box.min.z - ball.position.z, 0, ball.position.z - box.max.z);
      const radius = ball.radius + clearance;
      if (dx * dx + dz * dz < radius * radius) {
        lift = Math.max(lift, ball.position.y + Math.sqrt(radius * radius - dx * dx - dz * dz) - box.min.y);
      }
    }
  }
  return Math.max(0, lift);
}
