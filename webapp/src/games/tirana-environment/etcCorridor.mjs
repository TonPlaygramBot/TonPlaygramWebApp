// Keep scenic décor on the mapped walking deck and do not touch collision data.
const BRIDGE_ENDPOINTS = [[278.87, 351.56], [286.28, 384.99]];
export const ETC_BUILDING = '535208028';
export const DOWNTOWN_BUILDING = '1255594721';
export const DOWNTOWN_PLAYGROUND = 'node/9381914388';
export const PLAY_RADIUS = 3.5;

export function findEtcWalkBridge(roads) {
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.12;
  return roads.find(r => r.bridge && r.walk && !r.tunnel && (
    near(r.a, BRIDGE_ENDPOINTS[0]) && near(r.b, BRIDGE_ENDPOINTS[1]) ||
    near(r.b, BRIDGE_ENDPOINTS[0]) && near(r.a, BRIDGE_ENDPOINTS[1])
  ));
}

export function bridgeRibOffsets(road, excluded) {
  const dx = road.b[0] - road.a[0], dz = road.b[1] - road.a[1];
  const length = Math.hypot(dx,dz), x = (road.a[0] + road.b[0])/2, z = (road.a[1] + road.b[1])/2;
  if (length <= 2.8) return [];
  return Array.from({length:6}, (_,i) => (i/5-0.5)*(length-2.8))
    .filter(along => !excluded(x+dx*along/length,z+dz*along/length,road.w/2+.35));
}

export function etcRoofText(buildings) {
  const etc = buildings.find(b => b.id === ETC_BUILDING);
  if (!etc || !Number.isFinite(etc.h)) return undefined;
  // North-west approach, set back from the curved parapet; text is an
  // authored site identifier, not evidence of the current tenant's signage.
  return { x: 317, z: 415.6, roof: etc.h, yaw: -2.28 };
}

export function downtownPlayPoint(places, buildings, clear) {
  const tower = buildings.find(b => b.id === DOWNTOWN_BUILDING);
  const site = places.find(p => p.id === DOWNTOWN_PLAYGROUND && p.category === 'playground');
  if (!tower || !site || !Number.isFinite(site.x) || !Number.isFinite(site.z)) return undefined;
  if (!tower.p.some(([x,z]) => Math.hypot(x - site.x, z - site.z) < 36)) return undefined;
  if (!clear(site.x, site.z, PLAY_RADIUS)) return undefined;
  return site;
}
