import { PerspectiveCamera, Vector3 } from 'three';

export type SnakeCameraShot = {
  id: string;
  priority: number;
  /** First point is the live action, seen from the player's seat. */
  points: () => Vector3[];
  /** A steady direction for reduced motion, without changing perspective. */
  overview?: () => Vector3[];
  until?: number;
};
const validPoint = (p: Vector3) => Number.isFinite(p.x + p.y + p.z);

/** Only changes look direction. Position, FOV, zoom and projection stay untouched. */
export function createSnakeCameraDirector(camera: PerspectiveCamera, target: Vector3) {
  let shot: SnakeCameraShot | null = null;
  let active = false;
  let previousTime: number | null = null;
  let reducedTarget: Vector3 | null = null;
  const desired = new Vector3();
  const direction = new Vector3();
  return {
    start(next: SnakeCameraShot, now: number, _homePosition: Vector3, _homeTarget: Vector3) {
      if (shot && now < (shot.until ?? Infinity) && next.priority < shot.priority) return false;
      if (shot?.id === next.id) return false;
      shot = next; reducedTarget = null; active = true; previousTime = now;
      return true;
    },
    finish(id: string, now: number, hold = 320) {
      if (shot?.id === id) shot = { ...shot, priority: 0, until: now + hold };
    },
    cancel() {
      shot = null; active = false; previousTime = null; reducedTarget = null;
    },
    update(now: number, homePosition: Vector3, homeTarget: Vector3, reducedMotion = false) {
      if (!active) return false;
      const dt = Math.max(0, now - (previousTime ?? now));
      previousTime = now;
      if (shot && now > (shot.until ?? Infinity)) shot = null;
      camera.position.copy(homePosition);
      desired.copy(homeTarget);
      if (shot) {
        if (reducedMotion && !reducedTarget) {
          const points = (shot.overview?.() ?? shot.points()).filter(validPoint);
          reducedTarget = points.length
            ? points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(points.length)
            : homeTarget.clone();
        }
        const focus = reducedMotion ? reducedTarget : shot.points().find(validPoint);
        if (focus) desired.copy(focus);
        else shot = null;
      }
      const focusDistance = Math.max(0.1, homePosition.distanceTo(homeTarget));
      direction.copy(desired).sub(homePosition);
      if (direction.lengthSq() < 1e-8) direction.copy(homeTarget).sub(homePosition);
      desired.copy(homePosition).addScaledVector(direction.normalize(), focusDistance);
      const blend = reducedMotion ? 1 : 1 - Math.exp(-dt / (shot ? 160 : 260));
      target.lerp(desired, blend);
      // Keep OrbitControls' target radius stable while turning the head.
      direction.copy(target).sub(homePosition);
      if (direction.lengthSq() > 1e-8) target.copy(homePosition).addScaledVector(direction.normalize(), focusDistance);
      if (!shot && target.distanceTo(desired) < 0.001) {
        target.copy(homeTarget); active = false;
      }
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      return true;
    }
  };
}
