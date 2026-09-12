import * as THREE from 'three';

type Point2 = { x: number; y: number };
type Ball = { pos: Point2; active?: boolean; id?: string | number };

/** Spin is a point on the cue-facing hemisphere: x is screen right, y is up.
 * Camera position cannot make a physically reachable strike point illegal.
 * Test the tip's swept sphere, not an axis-aligned box around nearby balls. */
export function checkCueTipAccess(
  cue: Ball | null,
  spin: Point2,
  balls: Ball[],
  forward: Point2,
  radius: number,
  tipRadius: number
) {
  if (!cue) return { blocked: false, reason: '' };
  const length = Math.hypot(forward.x, forward.y) || 1;
  const dx = forward.x / length,
    dz = forward.y / length;
  const sx = Number.isFinite(spin.x) ? spin.x : 0;
  const sy = Number.isFinite(spin.y) ? spin.y : 0;
  const scale = Math.min(1, 0.75 / (Math.hypot(sx, sy) || 1));
  const side = sx * scale * radius,
    height = sy * scale * radius;
  const rear = Math.sqrt(
    Math.max(0, (radius + tipRadius) ** 2 - side ** 2 - height ** 2)
  );
  const tipX = cue.pos.x - dz * side - dx * rear;
  const tipZ = cue.pos.y + dx * side - dz * rear;
  for (const other of balls) {
    if (
      !other ||
      other === cue ||
      other.active === false ||
      (other.id === cue.id && cue.id != null)
    )
      continue;
    const ox = other.pos.x - tipX,
      oz = other.pos.y - tipZ;
    const behind = THREE.MathUtils.clamp(-(ox * dx + oz * dz), 0, radius * 3);
    const separationSq =
      (ox + dx * behind) ** 2 + (oz + dz * behind) ** 2 + height ** 2;
    if (separationSq < (radius + tipRadius) ** 2 - 1e-8) {
      return {
        blocked: true,
        reason: 'Another ball blocks the cue tip. Change aim or spin.'
      };
    }
  }
  return { blocked: false, reason: '' };
}

export function isLegalCuePlacement(
  point: Point2,
  balls: Ball[],
  cue: Ball,
  radius: number,
  bounds: { x: number; minY: number; maxY: number },
  pockets: Point2[] = [],
  pocketRadius = 0
) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return false;
  if (
    Math.abs(point.x) > bounds.x ||
    point.y < bounds.minY ||
    point.y > bounds.maxY
  )
    return false;
  if (
    pockets.some(
      (pocket) =>
        Math.hypot(point.x - pocket.x, point.y - pocket.y) < pocketRadius
    )
  )
    return false;
  return balls.every(
    (ball) =>
      ball === cue ||
      !ball.active ||
      Math.hypot(point.x - ball.pos.x, point.y - ball.pos.y) >=
        radius * 2 + radius * 0.015
  );
}

const axis = new THREE.Vector3();
const rotation = new THREE.Quaternion();
/** Integrate the simulated angular velocity. Draw visibly rotates backwards
 * while sliding; sidespin remains visible even when translation has stopped. */
export function rotatePoolBall(
  mesh: THREE.Object3D,
  omega: THREE.Vector3 | undefined,
  velocity: Point2,
  step: number,
  radius: number
) {
  if (omega && Number.isFinite(omega.lengthSq())) axis.copy(omega);
  else axis.set(velocity.y / radius, 0, -velocity.x / radius);
  const speed = axis.length();
  if (!(speed > 1e-8) || !(step > 0)) return;
  rotation.setFromAxisAngle(axis.divideScalar(speed), speed * step);
  mesh.quaternion.premultiply(rotation).normalize();
}
