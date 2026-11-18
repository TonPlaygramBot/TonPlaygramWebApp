import { MathUtils, Vector3 } from 'three';

export const LUDO_CAMERA_PRESENTATION = Object.freeze({
  diceResultHoldMs: 1500, turnMs: 520, returnMs: 760,
  broadcastMs: 700, minBroadcastMs: 460, maxBroadcastMs: 980, distanceMultiplierMs: 72,
  targetBlend: .6, sideBlend: .82, turnPlayerBlend: .58, sideAvatarBlend: 1.08
});
export type LudoCinematicPose = { position: Vector3; target: Vector3; lerp: number };
const up = new Vector3(0, 1, 0);

/** The same authored Ludo shoulder, final-projectile and impact camera for both games. */
export function resolveLudoFirearmCameraPose({ muzzle, target, singleShot = false,
  phase = 'shoulder', projectile, elapsed = 0, preFireLeadMs = 1, pickupLeadMs = 0
}: { muzzle: Vector3; target: Vector3; singleShot?: boolean;
  phase?: 'shoulder' | 'projectile' | 'impact'; projectile?: Vector3;
  elapsed?: number; preFireLeadMs?: number; pickupLeadMs?: number }): LudoCinematicPose {
  const direction = target.clone().sub(muzzle);
  if (direction.lengthSq() < 1e-7) direction.set(0, 0, -1);
  direction.normalize();
  const side = up.clone().cross(direction);
  if (side.lengthSq() < 1e-7) side.set(1, 0, 0);
  side.normalize();
  if (phase === 'projectile' && projectile) return {
    position: projectile.clone().addScaledVector(direction, -.15)
      .addScaledVector(side, singleShot ? .018 : .03).addScaledVector(up, singleShot ? .07 : .082),
    target: projectile.clone().addScaledVector(direction, .34), lerp: .72
  };
  if (phase === 'impact') return {
    position: target.clone().addScaledVector(direction, -.28).addScaledVector(side, .08).addScaledVector(up, .16),
    target: target.clone().addScaledVector(up, .018), lerp: .62
  };
  const blend = MathUtils.clamp(elapsed / Math.max(1, preFireLeadMs), 0, 1);
  return {
    position: muzzle.clone().addScaledVector(direction, -(singleShot ? .36 : .46))
      .addScaledVector(side, singleShot ? .09 : .13)
      .addScaledVector(up, MathUtils.lerp(.12, singleShot ? .16 : .18, blend)),
    target: muzzle.clone().lerp(target, MathUtils.lerp(.42, .72, blend)).addScaledVector(up, .018),
    lerp: elapsed < pickupLeadMs ? .1 : .18
  };
}

export function applyLudoCinematicPose(position: Vector3, target: Vector3, pose: LudoCinematicPose, deltaSeconds: number) {
  const blend = 1 - Math.pow(1 - MathUtils.clamp(pose.lerp ?? .28, .02, 1), deltaSeconds * 60);
  if (pose.position?.isVector3) position.lerp(pose.position, blend);
  if (pose.target?.isVector3) target.lerp(pose.target, Math.min(1, blend * 1.18));
}

export function resolveLudoBroadcastDuration(distance: number) {
  const c = LUDO_CAMERA_PRESENTATION;
  return MathUtils.clamp(c.broadcastMs + (distance - 3.2) * c.distanceMultiplierMs, c.minBroadcastMs, c.maxBroadcastMs);
}

/** Stable top/bottom view; side players use the same shoulder-wide table framing. */
export function resolveLudoDiceCameraTarget(home: Vector3, seat: Vector3, seatIndex: number,
  surfaceY: number, targetLift: number) {
  const direction = seat.clone().sub(home).setY(0);
  if (seatIndex === 0 || seatIndex === 2 || Math.abs(direction.z) >= Math.abs(direction.x)) return home.clone();
  const c = LUDO_CAMERA_PRESENTATION;
  const target = home.clone().lerp(seat, c.turnPlayerBlend * c.sideAvatarBlend);
  target.y = surfaceY + targetLift;
  return target;
}
