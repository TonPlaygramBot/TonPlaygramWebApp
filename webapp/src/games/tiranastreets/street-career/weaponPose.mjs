import { WEAPON_BY_ID } from '../shared/weapons.mjs';
import { direction3 } from './spatialCore.mjs';
/** Named anchors for the normalized existing models. These authored offsets
 * share the visual muzzle and the simulation muzzle; fine finger contact still
 * needs device visual review for each model variant. */
export function weaponAnchors(id) {
  const w = WEAPON_BY_ID.get(id),
    sidearm = w?.category === 'sidearm',
    length = w?.category === 'melee' ? .30 : sidearm ? 0.28 : w?.radius ? 0.72 : 0.7;
  return {
    length,
    rightGrip: { x: 0, y: -0.045, z: -length * 0.2 },
    leftSupport: { x: -0.06, y: -0.03, z: length * 0.35 },
    muzzle: { x: 0, y: 0.045, z: length * 0.72 },
    sight: { x: 0, y: 0.065, z: 0 }
  };
}
export function weaponPose(p, b) {
  const a = weaponAnchors(p.weapon),
    d = direction3(b.yaw, b.pitch),
    r = { x: Math.cos(b.yaw), y: 0, z: -Math.sin(b.yaw) },
    wall = Math.max(0, Math.min(1, (0.8 - b.wall) / 0.6));
  const yaw = b.yaw,
    pitch = b.pitch - wall * 0.85,
    barrel = direction3(yaw, pitch),
    side = b.aim ? 0 : 0.15;
  const origin = {
    x: p.x + r.x * side + d.x * (0.37 - wall * 0.2),
    y:
      b.y +
      b.eye -
      (b.aim ? a.sight.y : 0.16) -
      wall * 0.27 +
      d.y * (0.37 - wall * 0.2),
    z: p.z + r.z * side + d.z * (0.37 - wall * 0.2)
  };
  const muzzle = {
    x: origin.x + barrel.x * a.muzzle.z + Math.sin(yaw) * Math.sin(pitch) * a.muzzle.y,
    y: origin.y + a.muzzle.y * Math.cos(pitch) + barrel.y * a.muzzle.z,
    z: origin.z + barrel.z * a.muzzle.z
  };
  return { origin, muzzle, pitch, yaw, anchors: a, wall };
}
