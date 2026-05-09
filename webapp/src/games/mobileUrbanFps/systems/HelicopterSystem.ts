import * as THREE from 'three';

export type FlightBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const helicopterFlightConfig = {
  forwardSpeed: 25,
  strafeSpeed: 15,
  liftSpeed: 15,
  minAltitude: 4.5,
  maxAltitude: 75,
  cameraLerp: 0.28
} as const;

export function isNearPoint(
  position: THREE.Vector3,
  point: THREE.Vector3,
  radius: number
) {
  return position.distanceTo(point) <= radius;
}

export function stepHelicopterFlight({
  position,
  yaw,
  pitch,
  moveX,
  moveY,
  lift,
  dt,
  bounds
}: {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
  moveX: number;
  moveY: number;
  lift: number;
  dt: number;
  bounds: FlightBounds;
}) {
  const forward = new THREE.Vector3(
    Math.sin(yaw),
    Math.sin(-pitch) * 0.4,
    Math.cos(yaw) * -1
  );
  const right = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const forwardMove = forward.multiplyScalar(
    moveY * helicopterFlightConfig.forwardSpeed
  );
  const sideMove = right.multiplyScalar(
    moveX * helicopterFlightConfig.strafeSpeed
  );
  position.addScaledVector(forwardMove.add(sideMove), dt);
  position.y += lift * helicopterFlightConfig.liftSpeed * dt;
  position.x = THREE.MathUtils.clamp(position.x, bounds.minX, bounds.maxX);
  position.z = THREE.MathUtils.clamp(position.z, bounds.minZ, bounds.maxZ);
  position.y = THREE.MathUtils.clamp(
    position.y,
    helicopterFlightConfig.minAltitude,
    helicopterFlightConfig.maxAltitude
  );
}
