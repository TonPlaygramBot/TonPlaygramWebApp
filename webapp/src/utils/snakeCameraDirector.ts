import { applyLudoCinematicPose, resolveLudoBroadcastDuration, LUDO_CAMERA_PRESENTATION, type LudoCinematicPose } from './ludoCameraPresentation';
import { PerspectiveCamera, Vector3 } from 'three';

export type SnakeCameraShot = {
  id: string;
  priority: number;
  /** First point is the live action, seen from the player's seat. */
  points: () => Vector3[];
  /** A steady direction for reduced motion, without changing perspective. */
  overview?: () => Vector3[];
  until?: number;
  cameraPose?: () => LudoCinematicPose | null;
  /** Use Ludo table-plane framing rather than centering a moving die. */
  ludoFraming?: boolean;
};
const validPoint = (p: Vector3) => Number.isFinite(p.x + p.y + p.z);

/** Seat-locked action looks plus shared Ludo firearm poses; lens/projection stay untouched. */
export function createSnakeCameraDirector(camera: PerspectiveCamera, target: Vector3) {
  let shot: SnakeCameraShot | null = null;
  let active = false;
  let previousTime: number | null = null;
  let reducedTarget: Vector3 | null = null;
  let cinematicReturn: { start: number; position: Vector3; target: Vector3 } | null = null;
  let ludoTransition: { start: number; from: Vector3; duration: number } | null = null;
  const desired = new Vector3();
  const direction = new Vector3();
  return {
    isCinematic: () => Boolean(shot?.cameraPose?.()),
    start(next: SnakeCameraShot, now: number, _homePosition: Vector3, _homeTarget: Vector3) {
      if (shot && now < (shot.until ?? Infinity) && next.priority < shot.priority) return false;
      if (shot?.id === next.id) return false;
      shot = next; reducedTarget = null; active = true; previousTime = now;
      cinematicReturn = null;
      ludoTransition = next.ludoFraming ? { start: now, from: target.clone(),
        duration: resolveLudoBroadcastDuration(camera.position.distanceTo(next.points()[0] ?? _homeTarget)) } : null;
      return true;
    },
    finish(id: string, now: number, hold = 320) {
      if (shot?.id === id) shot = { ...shot, priority: 0, until: now + hold };
    },
    cancel() {
      shot = null; active = false; previousTime = null; reducedTarget = null; cinematicReturn = null; ludoTransition = null;
    },
    update(now: number, homePosition: Vector3, homeTarget: Vector3, reducedMotion = false) {
      if (!active) return false;
      const dt = Math.max(0, now - (previousTime ?? now));
      previousTime = now;
      if (shot && now > (shot.until ?? Infinity)) {
        if (shot.cameraPose) cinematicReturn = {start: now, position: camera.position.clone(), target: target.clone()};
        if (shot.ludoFraming) ludoTransition = {start: now, from: target.clone(), duration: LUDO_CAMERA_PRESENTATION.returnMs};
        shot = null;
      }
      const pose = !reducedMotion && shot?.cameraPose?.();
      if (pose) {
        applyLudoCinematicPose(camera.position, target, pose, dt / 1000);
        camera.lookAt(target); camera.updateMatrixWorld(true); return true;
      }
      if (cinematicReturn) {
        const t = Math.min(1, (now - cinematicReturn.start) / LUDO_CAMERA_PRESENTATION.returnMs);
        const eased = t * t * (3 - 2 * t);
        camera.position.copy(cinematicReturn.position).lerp(homePosition, eased);
        target.copy(cinematicReturn.target).lerp(homeTarget, eased);
        camera.lookAt(target); camera.updateMatrixWorld(true);
        if (t >= 1) { camera.position.copy(homePosition); target.copy(homeTarget); cinematicReturn = null; active = false; }
        return true;
      }
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
      if (ludoTransition) {
        const t = reducedMotion ? 1 : Math.min(1, (now - ludoTransition.start) / ludoTransition.duration);
        target.copy(ludoTransition.from).lerp(desired, t * t * (3 - 2 * t));
        camera.lookAt(target); camera.updateMatrixWorld(true);
        if (!shot && t >= 1) { active = false; ludoTransition = null; }
        return true;
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
