import { detailPostObstacles } from '../../tirana-street-detail/sharedRoadDetails.mjs';
import { nativeReplacementIds } from '../../tirana-landmarks/nativeLocations.mjs';
import { nativeLandmarkObstacles } from '../../tirana-landmarks/nativeCollision.mjs';
import {FUEL_CANOPY_IDS,fuelCanopyObstacles} from '../../tirana-street-life/fuelCollision.mjs';
import { buildingProfile, footprintDistance } from '../../tiranastreets/shared/architecture.mjs';
import { STREET_SOLIDS } from '../../tiranastreets/shared/streetDressing.mjs';
import { RAILINGS } from '../../tiranastreets/shared/landscape.mjs';
import { CITY_BUILDING_DATA } from '../../tirana-city-source/cityBuildingData.mjs';
import { WORLD } from '../../tiranastreets/shared/world.mjs';

// Only a translation: east remains +X, south +Z, and one unit remains one meter.
// The source of truth is Tirana Streets' checked-in OSM snapshot, not a redraw.
export const ORIGIN = Object.freeze({ x: -220, z: 600 });
export const MAP = Object.freeze({
  minX: WORLD.bounds[0] - ORIGIN.x,
  minZ: WORLD.bounds[1] - ORIGIN.z,
  maxX: WORLD.bounds[2] - ORIGIN.x,
  maxZ: WORLD.bounds[3] - ORIGIN.z
});
export const ATTRIBUTION = WORLD.attribution;
export const SOURCE_SHA256 = WORLD.sourceSha256;
export const roads = WORLD.roads.map((r, id) => ({
  ...r,
  id,
  a: [r.a[0] - ORIGIN.x, r.a[1] - ORIGIN.z],
  b: [r.b[0] - ORIGIN.x, r.b[1] - ORIGIN.z]
}));
const streets = roads.filter((r) => !r.walk);
export function nearestRoad(x, z) {
  let best,
    distance = Infinity;
  for (const r of streets) {
    const dx = r.b[0] - r.a[0],
      dz = r.b[1] - r.a[1],
      l = dx * dx + dz * dz,
      t = l
        ? Math.max(0, Math.min(1, ((x - r.a[0]) * dx + (z - r.a[1]) * dz) / l))
        : 0;
    const px = r.a[0] + dx * t,
      pz = r.a[1] + dz * t,
      d = Math.hypot(x - px, z - pz);
    if (d < distance) {
      distance = d;
      best = { x: px, z: pz, road: r, distance: d };
    }
  }
  return best;
}
const catalogBuildings = new Map(CITY_BUILDING_DATA.buildings.map(b=>[b.id,b]));
const innerMembers = new Set(CITY_BUILDING_DATA.buildings.flatMap(b=>b.replaces??[]));
const existingBuildingIds=new Set(WORLD.buildings.map(b=>b.id));
const collisionBuildings=[...WORLD.buildings,...CITY_BUILDING_DATA.buildings.filter(b=>
  !existingBuildingIds.has(b.id)&&b.p.every(([x,z])=>x>=WORLD.bounds[0]&&x<=WORLD.bounds[2]&&z>=WORLD.bounds[1]&&z<=WORLD.bounds[3]))];
export const buildings = collisionBuildings.filter(b=>!innerMembers.has(b.id)).map((b, i) => {
  const footprint = b.p.map((p) => [p[0] - ORIGIN.x, p[1] - ORIGIN.z]);
  const xs = footprint.map((p) => p[0]),
    zs = footprint.map((p) => p[1]);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2,
    z = (Math.min(...zs) + Math.max(...zs)) / 2;
  // Exact world-space footprint; its bounds are only the broad-phase index.
  const rot = 0;
  return {
    id: b.id,
    x,
    z,
    rot,
    template: i % 10,
    footprint,
    holes: (catalogBuildings.get(b.id)?.holes??[]).map(r=>r.map(p=>[p[0]-ORIGIN.x,p[1]-ORIGIN.z])),
    w: Math.max(...xs) - Math.min(...xs),
    d: Math.max(...zs) - Math.min(...zs),
    h: buildingProfile(b).height ?? b.h
  };
});
// Begin in the renovated pedestrian square, with the city's landmarks visible.
export const START = Object.freeze({ x: -55 - ORIGIN.x, z: -110 - ORIGIN.z });
export const SPAWNS = Object.freeze(
  Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4,
      p = { x: START.x + Math.sin(a) * 48, z: START.z + Math.cos(a) * 48 };
    return Object.freeze({ x: p.x, z: p.z });
  })
);
const exit = { x: START.x - 15, z: START.z - 65 };
export const EXTRACTION = Object.freeze({ x: exit.x, z: exit.z });
const originals = [
  [-4, 9, 3.4, 1, 0.95],
  [7, 1, 3.4, 1, 0.95],
  [-5, -18, 3.4, 1, 0.95],
  [6, -25, 3.4, 1, 0.95],
  [-9, -5, 3.2, 7, 2.55],
  [9, -13, 3.2, 7, 2.55],
  [8, 12, 2.1, 4.7, 1.45],
  [-9, -24, 2.1, 4.7, 1.45],
  [12, 20, 1.1, 1.1, 1.18],
  [-12, 1, 1.1, 1.1, 1.18],
  [12, -22, 1.1, 1.1, 1.18],
  [-12, -16, 1.1, 1.1, 1.18]
];
export const props = originals.map(([sx, sz, w, d, h], i) => {
  const a = i * Math.PI * 0.47,
    p = nearestRoad(
      START.x + Math.sin(a) * (13 + i * 3),
      START.z + Math.cos(a) * (13 + i * 3)
    );
  const dx = p.road.b[0] - p.road.a[0],
    dz = p.road.b[1] - p.road.a[1],
    l = Math.hypot(dx, dz) || 1;
  const offset = Math.max(0, p.road.w / 2 - w / 2 - 0.35) * (i % 2 ? 1 : -1);
  return {
    sx,
    sz,
    x: p.x + (dz / l) * offset,
    z: p.z - (dx / l) * offset,
    w,
    d,
    h,
    rot: Math.atan2(dx, dz)
  };
});
// Fixtures are shared with the renderer, including open bus-shelter interiors.
export const streetObstacles = STREET_SOLIDS.map(p => {
  const [x0,z0,x1,z1] = p.box, x=(x0+x1)/2, z=(z0+z1)/2;
  return {x:p.x-ORIGIN.x+x*Math.cos(p.yaw)+z*Math.sin(p.yaw),
    z:p.z-ORIGIN.z-x*Math.sin(p.yaw)+z*Math.cos(p.yaw),
    w:x1-x0,d:z1-z0,h:p.name==='bus_shelter'?2.5:p.name==='utility_cabinet'?1.55:.8,rot:p.yaw};
});
export const railingObstacles = RAILINGS.map(r=>({x:r.x-ORIGIN.x,z:r.z-ORIGIN.z,w:.1,d:r.length,h:1.05,rot:r.yaw}));
const replaced = nativeReplacementIds(WORLD);
export const landmarkObstacles = nativeLandmarkObstacles(WORLD, ORIGIN);
export const OBSTACLES = Object.freeze([...buildings.filter(b=>!replaced.has(b.id)&&!FUEL_CANOPY_IDS.has(b.id)), ...fuelCanopyObstacles(ORIGIN), ...landmarkObstacles, ...props, ...streetObstacles, ...railingObstacles, ...detailPostObstacles(ORIGIN)]);
const clear = (x,z,r=.5) => !OBSTACLES.some(o=>o.footprint?footprintDistance(x,z,o.footprint,o.holes)<r:Math.hypot(x-o.x,z-o.z)<Math.hypot(o.w,o.d)/2+r);
const safeNear = (x,z) => {x=Math.max(MAP.minX+2,Math.min(MAP.maxX-2,x));z=Math.max(MAP.minZ+2,Math.min(MAP.maxZ-2,z));const road=nearestRoad(x,z); if(clear(road.x,road.z))return {x:road.x,z:road.z}; for(let radius=4;radius<60;radius+=4)for(let i=0;i<16;i++){const p=nearestRoad(x+Math.cos(i*Math.PI/8)*radius,z+Math.sin(i*Math.PI/8)*radius);if(clear(p.x,p.z)&&p.x>MAP.minX+.5&&p.x<MAP.maxX-.5&&p.z>MAP.minZ+.5&&p.z<MAP.maxZ-.5)return {x:p.x,z:p.z};} return {x:START.x,z:START.z}; };
// Ten operation maps are sectors of the one detailed, streamed Tirana world.
const sector = (id,name,worldX,worldZ) => {const start=safeNear(worldX-ORIGIN.x,worldZ-ORIGIN.z),extraction=safeNear(start.x+18,start.z-42);return Object.freeze({id,name,start:Object.freeze(start),extraction:Object.freeze(extraction)});};
export const BATTLEFIELD_MAPS = Object.freeze([
 sector('skanderbeg','Skanderbeg Square',-55,-110),sector('blloku','Blloku Night Run',-165,520),sector('lana','Lana Riverfront',40,260),sector('pyramid','Pyramid District',120,85),sector('bazaar','New Bazaar',175,-155),sector('stadium','Air Albania',285,245),sector('station','Railway Approach',-120,-340),sector('park','Grand Park Gate',35,690),sector('embassy','Embassy Quarter',-330,170),sector('dajti-gate','Dajti Gateway',360,-25)
]);
