import { Object3D, Vector3 } from 'three';

// Shared with Ludo: eye position follows the local seated human, not the turn owner.
export const SEATED_PLAYER_VIEW = Object.freeze({
  fov: 78,
  forward: 0.10,
  up: 0.075,
  yawLimit: Math.PI * 26 / 180,
  pitchMin: -Math.PI * 6 / 180,
  pitchMax: Math.PI * 12 / 180,
  yawDrag: 0.0055,
  pitchDrag: -0.0038
});
const headPosition = new Vector3();
const direction = new Vector3();

export function resolveSeatedPlayerEyePosition(head: Object3D | null | undefined, target: Vector3, out: Vector3) {
  if (!head?.isObject3D) return false;
  head.updateWorldMatrix(true, false);
  head.getWorldPosition(headPosition);
  if (![headPosition.x, headPosition.y, headPosition.z, target.x, target.y, target.z].every(Number.isFinite)) return false;
  direction.copy(target).sub(headPosition);
  if (direction.lengthSq() < 1e-8) return false;
  out.copy(headPosition).addScaledVector(direction.normalize(), SEATED_PLAYER_VIEW.forward);
  out.y += SEATED_PLAYER_VIEW.up;
  return true;
}

export function updateSeatedPlayerLook(look: { yaw: number; pitch: number }, dx: number, dy: number) {
  look.yaw = Math.max(-SEATED_PLAYER_VIEW.yawLimit, Math.min(SEATED_PLAYER_VIEW.yawLimit, look.yaw + dx * SEATED_PLAYER_VIEW.yawDrag));
  look.pitch = Math.max(SEATED_PLAYER_VIEW.pitchMin, Math.min(SEATED_PLAYER_VIEW.pitchMax, look.pitch + dy * SEATED_PLAYER_VIEW.pitchDrag));
}
