import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

export type SnakeCameraShot = {
  id: string;
  priority: number;
  points: () => Vector3[];
  /** Whole route for a steady shot when reduced motion is enabled. */
  overview?: () => Vector3[];
  radius: number;
  minDistance: number;
  elevation?: number;
  until?: number;
};

const UP = new Vector3(0, 1, 0);
// Leave room above and below the action for the portrait game HUD.
const SAFE_X = 0.72;
const SAFE_Y = 0.55;
const validPoint = (p: Vector3) => Number.isFinite(p.x + p.y + p.z);

function requiredDistance(
  camera: PerspectiveCamera, points: Vector3[], target: Vector3,
  direction: Vector3, radius: number, minimum: number
) {
  const right = new Vector3().crossVectors(UP, direction).normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  const tanY = Math.tan(MathUtils.degToRad(camera.getEffectiveFOV()) / 2);
  const tanX = tanY * Math.max(0.1, camera.aspect);
  let distance = minimum;
  const relative = new Vector3();
  for (const point of points) {
    relative.copy(point).sub(target);
    const depth = relative.dot(direction);
    distance = Math.max(distance,
      depth + radius + (Math.abs(relative.dot(right)) + radius) / (tanX * SAFE_X),
      depth + radius + (Math.abs(relative.dot(up)) + radius) / (tanY * SAFE_Y),
      depth + radius + camera.near * 2);
  }
  return distance;
}

/** World-space framing shared by the game and the camera preview. */
export function frameSnakeAction(
  camera: PerspectiveCamera, points: Vector3[], direction: Vector3,
  radius: number, minDistance: number
) {
  const target = new Vector3();
  points.forEach(point => target.add(point));
  target.multiplyScalar(1 / Math.max(1, points.length));
  const distance = requiredDistance(camera, points, target, direction, radius, minDistance);
  return { target, position: target.clone().addScaledVector(direction, distance) };
}

/** Sole owner of the action camera; call after moving scene objects, before rendering. */
export function createSnakeCameraDirector(camera: PerspectiveCamera, target: Vector3) {
  let shot: SnakeCameraShot | null = null;
  let active = false;
  let previousTime: number | null = null;
  let reducedPoints: Vector3[] | null = null;
  const direction = new Vector3(0, 1.8, 1).normalize();

  return {
    start(next: SnakeCameraShot, now: number, homePosition: Vector3, homeTarget: Vector3) {
      if (shot && now < (shot.until ?? Infinity) && next.priority < shot.priority) return false;
      if (shot?.id === next.id) return false;
      direction.copy(homePosition).sub(homeTarget).setY(0);
      if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
      direction.normalize().setY(Math.tan(MathUtils.degToRad(next.elevation ?? 62))).normalize();
      shot = next;
      reducedPoints = null;
      active = true;
      previousTime = now;
      return true;
    },
    finish(id: string, now: number, hold = 320) {
      if (shot?.id === id) shot = { ...shot, priority: 0, until: now + hold };
    },
    cancel() {
      shot = null;
      active = false;
      previousTime = null;
      reducedPoints = null;
    },
    update(now: number, homePosition: Vector3, homeTarget: Vector3, reducedMotion = false) {
      if (!active) return false;
      const dt = Math.max(0, now - (previousTime ?? now));
      previousTime = now;
      if (shot && now > (shot.until ?? Infinity)) shot = null;
      const blend = reducedMotion ? 1 : 1 - Math.exp(-dt / (shot ? 125 : 240));
      if (shot) {
        if (reducedMotion && !reducedPoints) {
          reducedPoints = (shot.overview?.() ?? shot.points()).filter(validPoint).map(p => p.clone());
        }
        const points = reducedMotion ? reducedPoints! : shot.points().filter(validPoint);
        if (!points.length) { shot = null; return true; }
        const frame = frameSnakeAction(camera, points, direction, shot.radius, shot.minDistance);
        target.lerp(frame.target, blend);
        camera.position.lerp(frame.position, blend);
        // Keep the entire action visible even during the approach to a new shot.
        // Fitting from the interpolated pose also handles narrow phones and resize.
        const offset = camera.position.clone().sub(target);
        if (offset.lengthSq() < 1e-6) offset.copy(direction);
        const length = offset.length();
        offset.normalize();
        if (Math.abs(offset.y) > 0.9999) offset.copy(direction);
        const safeDistance = requiredDistance(camera, points, target, offset, shot.radius, length);
        camera.position.copy(target).addScaledVector(offset, safeDistance);
      } else {
        target.lerp(homeTarget, blend);
        camera.position.lerp(homePosition, blend);
        if (camera.position.distanceTo(homePosition) < 0.001 && target.distanceTo(homeTarget) < 0.001) {
          camera.position.copy(homePosition);
          target.copy(homeTarget);
          active = false;
        }
      }
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      return true;
    }
  };
}
