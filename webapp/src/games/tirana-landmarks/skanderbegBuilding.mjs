/** The new face-shaped tower is distinct from the equestrian monument.
 * These two existing OSM building parts share one authored exterior; suppress
 * both old shells. Their footprints locate the replacement; physics uses the
 * actual Blender floor contours instead of the obsolete full-height prisms.
 */
import collisionBands from './skanderbeg-building-collision.mjs';
export const ROCK_REPLACEMENT_IDS = new Set(['1482874836', '1482874842']);
export const SKANDERBEG_BUILDING = Object.freeze({
  id: 'skanderbeg-building', name: 'Skanderbeg Building · Tirana’s Rock',
  headId: '1482874842', podiumId: '1482874836', height: 85, floors: 25,
  yaw: -.43, groundY: .06, nearDistance: 520, batteryNearDistance: 170,
  source: 'https://www.mvrdv.com/projects/461/skanderbeg-building',
  mapSource: 'https://www.openstreetmap.org/way/1482874842',
  accuracy: 'Original balcony-profile interpretation; mapped site and architect height, unsurveyed fittings',
});
export function resolveSkanderbegBuilding(world) {
  const head = world.buildings.find(b => String(b.id) === SKANDERBEG_BUILDING.headId);
  const podium = world.buildings.find(b => String(b.id) === SKANDERBEG_BUILDING.podiumId);
  if (!head || !podium || head.p.length < 3 || podium.p.length < 3) return null;
  const x = head.p.reduce((sum, p) => sum + p[0], 0) / head.p.length;
  const z = head.p.reduce((sum, p) => sum + p[1], 0) / head.p.length;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return {...SKANDERBEG_BUILDING, x, z, headFootprint: head.p, podiumFootprint: podium.p};
}

/** Use the same authored floor contours for walking, cars, gunfire and flying.
 * minHeight also serves the legacy 2D and camera predicates; minY is the 3D
 * band bottom. Neither may be omitted, or balconies become ground barriers.
 */
export function skanderbegBuildingSolids(world) {
  const location=resolveSkanderbegBuilding(world);
  if(!location)return [];
  const c=Math.cos(location.yaw),s=Math.sin(location.yaw);
  const transform=ring=>ring.map(([x,z])=>[location.x+x*c+z*s,location.z-x*s+z*c]);
  return collisionBands.map(b=>({
    id:`skanderbeg-building:${b.part}`,landmarkId:location.id,
    minY:b.minY+location.groundY,minHeight:b.minY+location.groundY,h:b.h+location.groundY,
    p:transform(b.p),...(b.holes?{holes:b.holes.map(transform)}:{}),
    collisionSource:'Blender-authored-floor-contours',
  }));
}
