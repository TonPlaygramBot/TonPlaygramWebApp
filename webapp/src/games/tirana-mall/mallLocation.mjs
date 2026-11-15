import { WORLD } from '../tiranastreets/shared/world.mjs';
const anchor = WORLD.landmarks.find(landmark => landmark.id === 'pyramid');
if (!anchor) throw new Error('Pyramid mall requires the mapped Pyramid landmark');
export const PYRAMID_MALL = Object.freeze({ ...anchor, name: 'TonPlayGram Gaming Mall', radius: 75 });
export function distanceToPyramid(player) {
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.z)) return Infinity;
  return Math.hypot(player.x - anchor.x, player.z - anchor.z);
}
export function isNearPyramid(player) {
  return Boolean(player && !player.carId && distanceToPyramid(player) <= PYRAMID_MALL.radius);
}
