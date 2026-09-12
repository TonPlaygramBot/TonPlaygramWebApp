import type { Player } from '../shared/engine.mjs';
import type { BodyState } from './StreetSimulation.mjs';
import type { Vec3 } from './spatialCore.mjs';
export function weaponAnchors(id: string): {
  length: number;
  rightGrip: Vec3;
  leftSupport: Vec3;
  muzzle: Vec3;
  sight: Vec3;
};
export function weaponPose(
  p: Player,
  b: BodyState
): {
  origin: Vec3;
  muzzle: Vec3;
  pitch: number;
  yaw: number;
  anchors: ReturnType<typeof weaponAnchors>;
  wall: number;
};
