import {importedFleet,IMPORTED_PLACEMENT_ORIGIN} from '../../blackwater/shared/importedPlacements.mjs';
import {VEHICLE_COLLECTION} from './vehicleCollection.mjs';
import {COLLECTION_PLACEMENTS} from './collectionPlacements.mjs';
import {KARTS} from '../../kartroyale/vehicleCatalog.mjs';
import { WORLD } from './world.mjs';
import {FUEL_CANOPY_IDS,fuelCanopyObstacles} from '../../tirana-street-life/fuelCollision.mjs';
import {
  equipStarter,
  initCityLife,
  lifeAction,
  updateCityLife, harm
} from './cityLife.mjs';
import {
  airAction,
  initAirMobility,
  updateAirMobility
} from './airMobility.mjs';
import { difficultyOf } from './weapons.mjs';
import { populateTraffic, updateTraffic, vehicleSeparation } from './trafficSimulation.mjs';
import { initCityPopulation, shopObstacles, shopObstaclesNear } from './cityPopulation.mjs';
import {updateEmergencyResponse} from './emergencyResponse.mjs';
import {footprintIndex} from '../../tirana-city-source/footprintIndex.mjs';

export { WORLD };
export const STEP = 1 / 60;
export const MAX_PLAYERS = 4;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const emptyInput = () => ({
  x: 0,
  y: 0,
  yaw: 0,
  fast: false,
  brake: false,
  fire: false,
  seq: 0
});
export const freshCareer = () => ({ completed: [], best: {}, credits: 0 });
export const FREE_ROAM = {
  id: 'free-roam',
  title: 'The city is yours',
  district: 'TIRANA',
  type: 'free',
  description:
    'Explore central Tirana with no clock. Walk, drive and discover the landmarks.',
  time: 0,
  reward: 0,
  stops: []
};
const nodes = WORLD.graph.nodes;
const links = nodes.map(() => []);
for (const [index,[a, b]] of WORLD.graph.edges.entries()) {
  const d = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]);
  const direction=WORLD.graph.directions?.[index]??0;
  if(direction!==-1)links[a].push([b, d]);
  if(direction!==1)links[b].push([a, d]);
}
export function nearestNode(x, z) {
  let best = 0,
    d = Infinity;
  nodes.forEach((p, i) => {
    const n = (x - p[0]) ** 2 + (z - p[1]) ** 2;
    if (n < d) {
      best = i;
      d = n;
    }
  });
  return best;
}
const point = (i) => ({ x: nodes[i][0], z: nodes[i][1] });
export function roadPoint(x, z) {
  return point(nearestNode(x, z));
}
// A small binary heap keeps route finding bounded on the real street graph.
export function route(a, b) {
  if (a === b) return [point(b)];
  const dist = new Float64Array(nodes.length).fill(Infinity);
  const prev = new Int32Array(nodes.length).fill(-1);
  const heap = [];
  const push = (v) => {
    heap.push(v);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= v[0]) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = v;
  };
  const pop = () => {
    const top = heap[0],
      v = heap.pop();
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let c = i * 2 + 1;
        if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++;
        if (heap[c][0] >= v[0]) break;
        heap[i] = heap[c];
        i = c;
      }
      heap[i] = v;
    }
    return top;
  };
  dist[a] = 0;
  push([0, a]);
  while (heap.length) {
    const [cost, n] = pop();
    if (n === b) break;
    if (cost !== dist[n]) continue;
    for (const [v, d] of links[n]) {
      if (cost + d < dist[v]) {
        dist[v] = cost + d;
        prev[v] = n;
        push([dist[v], v]);
      }
    }
  }
  if(!Number.isFinite(dist[b]))return [];
  const out = [];
  for (let n = b; n >= 0; n = prev[n]) {
    out.push(point(n));
    if (n === a) break;
  }
  return out.reverse();
}
const landmark = (id) => WORLD.landmarks.find((p) => p.id === id);
const stop = (id, dx = 0, dz = 0) => {
  const p = landmark(id);
  return { ...roadPoint(p.x + dx, p.z + dz), name: p.name };
};
export const MISSIONS = [
  {
    id: 'first-shift',
    title: 'First shift',
    district: 'QENDËR',
    type: 'delivery',
    description:
      'Your first courier job. Collect a parcel, then make two city deliveries.',
    time: 210,
    reward: 150,
    stops: [
      stop('rinia', -85, 0),
      stop('pyramid', -75, 0),
      stop('square', -50, 100)
    ]
  },
  {
    id: 'lana-run',
    title: 'The Lana run',
    district: 'LANA',
    type: 'race',
    description:
      'Beat Ardi through the river corridor. Follow the street route to each checkpoint.',
    time: 280,
    reward: 250,
    stops: [
      stop('pyramid', -80, 50),
      stop('lana', 0, 0),
      stop('blloku', 0, 0),
      stop('rinia', -95, 0),
      stop('square', -50, 100)
    ]
  },
  {
    id: 'after-hours',
    stars: 2,
    title: 'After hours',
    district: 'BLLOKU',
    type: 'pursuit',
    description:
      'Reach the safe points while the fictional patrol gives chase. Keep your car moving.',
    time: 240,
    reward: 300,
    stops: [
      stop('rinia', -90, 50),
      stop('blloku', -40, 0),
      stop('mother', 0, -70),
      stop('pyramid', -80, 0)
    ]
  },
  {
    id: 'express',
    title: 'Blloku express',
    district: 'BLLOKU',
    type: 'delivery',
    description:
      'A longer express route. Stop at every marked delivery before the shift ends.',
    time: 300,
    reward: 350,
    stops: [
      stop('blloku', -50, 0),
      stop('mother', 0, -65),
      stop('pyramid', -75, 0),
      stop('rinia', -90, 0),
      stop('square', -50, 100)
    ]
  },
  {
    id: 'capital-circuit',
    title: 'Capital circuit',
    district: 'TIRANA',
    type: 'race',
    description:
      'Race Ardi around central Tirana. A sports car unlocks after three completed chapters.',
    time: 300,
    reward: 450,
    stops: [
      stop('rinia', -90, 0),
      stop('blloku', -50, 0),
      stop('mother', 0, -70),
      stop('pyramid', 80, 0),
      stop('square', -50, 100)
    ]
  },
  {
    id: 'city-lights',
    stars: 4,
    title: 'City lights',
    district: 'TIRANA',
    type: 'pursuit',
    description:
      'The final run: cross the city, escape the patrol and return to the square.',
    time: 300,
    reward: 600,
    stops: [
      stop('pyramid', -80, 0),
      stop('mother', 0, -70),
      stop('blloku', -50, 0),
      stop('rinia', -90, 0),
      stop('square', -50, 100)
    ]
  },
  {
    id: 'rinia-rescue',
    title: 'Rinia rescue',
    district: 'QENDËR',
    type: 'combat',
    stars: 1,
    enemies: 3,
    time: 240,
    reward: 650,
    description:
      'Clear the armed crew with your loadout, then reach the marked extraction.',
    stops: [stop('rinia', -85, 0)]
  },
  {
    id: 'boulevard-defense',
    title: 'Boulevard defense',
    district: 'LANA',
    type: 'combat',
    stars: 3,
    enemies: 6,
    time: 300,
    reward: 850,
    description:
      'A tougher armed crew holds the boulevard. Clear the area and extract before the patrol closes in.',
    stops: [stop('pyramid', -75, 0)]
  },
  {
    id: 'five-star-escape',
    title: 'Five-star escape',
    district: 'TIRANA',
    type: 'pursuit',
    stars: 5,
    time: 330,
    reward: 1100,
    description:
      "Military armor and soldiers join the pursuit. Cross all safe points to complete the city's hardest run.",
    stops: [
      stop('rinia', -90, 0),
      stop('blloku', -40, 0),
      stop('mother', 0, -70),
      stop('pyramid', -80, 0),
      stop('square', -50, 100)
    ]
  }
];
export const SPAWN = roadPoint(-60, 130);
const spawnNode = nearestNode(SPAWN.x, SPAWN.z);
const initialHeading = (() => {
  const n = links[spawnNode][0]?.[0];
  return n == null
    ? 0
    : Math.atan2(SPAWN.x - nodes[n][0], SPAWN.z - nodes[n][1]);
})();

export function insidePolygon(x, z, poly) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function closest(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = clamp(
    ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1),
    0,
    1
  );
  return [a[0] + dx * t, a[1] + dz * t];
}
const cells = new Map();
const roadCells = new Map();
for (const road of WORLD.roads) {
  const margin = road.w / 2 + 2;
  for (
    let x = Math.floor((Math.min(road.a[0], road.b[0]) - margin) / 40);
    x <= Math.floor((Math.max(road.a[0], road.b[0]) + margin) / 40);
    x++
  )
    for (
      let z = Math.floor((Math.min(road.a[1], road.b[1]) - margin) / 40);
      z <= Math.floor((Math.max(road.a[1], road.b[1]) + margin) / 40);
      z++
    ) {
      const key = `${x},${z}`;
      if (!roadCells.has(key)) roadCells.set(key, []);
      roadCells.get(key).push(road);
    }
}
const waterSegments = WORLD.water.flatMap((w) =>
  Array.isArray(w)
    ? []
    : w.line.slice(1).map((b, i) => ({ a: w.line[i], b, width: w.width }))
);
const waterCells=new Map();
const lakePolygons=(WORLD.waterAreas||[]).flatMap(w=>w.polygons.map(p=>({p:p.outer,holes:p.holes||[]})));
const lakeCandidates=footprintIndex(lakePolygons,80,4);
for(const water of waterSegments){const margin=water.width/2+6;
 for(let x=Math.floor((Math.min(water.a[0],water.b[0])-margin)/40);x<=Math.floor((Math.max(water.a[0],water.b[0])+margin)/40);x++)
  for(let z=Math.floor((Math.min(water.a[1],water.b[1])-margin)/40);z<=Math.floor((Math.max(water.a[1],water.b[1])+margin)/40);z++){const key=`${x},${z}`;if(!waterCells.has(key))waterCells.set(key,[]);waterCells.get(key).push(water);}
}
const importedSolids=importedFleet.filter(a=>a.assetId).map(a=>{const x=a.x+IMPORTED_PLACEMENT_ORIGIN.x,z=a.z+IMPORTED_PLACEMENT_ORIGIN.z;return {id:'imported-'+a.assetId,h:a.h,p:[[x-a.w/2,z-a.d/2],[x+a.w/2,z-a.d/2],[x+a.w/2,z+a.d/2],[x-a.w/2,z+a.d/2]]};});
const collisionBuildings = [...importedSolids,...WORLD.buildings.filter(b=>!FUEL_CANOPY_IDS.has(b.id)),...fuelCanopyObstacles().filter(b=>b.minY===0)];
// Read-only geometry contract for the optional local 3D player system.
export const collisionSolids = [...collisionBuildings, ...fuelCanopyObstacles().filter(b=>b.minY>0)];
const cameraBuildings = collisionBuildings.map((b) => ({
  ...b,
  minX: Math.min(...b.p.map((p) => p[0])),
  maxX: Math.max(...b.p.map((p) => p[0])),
  minZ: Math.min(...b.p.map((p) => p[1])),
  maxZ: Math.max(...b.p.map((p) => p[1]))
}));
const sightCells=new Map();
for(const b of cameraBuildings)for(let x=Math.floor(b.minX/100);x<=Math.floor(b.maxX/100);x++)
  for(let z=Math.floor(b.minZ/100);z<=Math.floor(b.maxZ/100);z++){
    const key=`${x}:${z}`;if(!sightCells.has(key))sightCells.set(key,[]);sightCells.get(key).push(b);
  }
function sightCandidates(a,b){
  const found=new Set();
  for(const s of shopObstacles())if(s.h>1.2&&Math.max(a.x,b.x)>=s.minX&&Math.min(a.x,b.x)<=s.maxX&&Math.max(a.z,b.z)>=s.minZ&&Math.min(a.z,b.z)<=s.maxZ)found.add(s);
  for(let x=Math.floor(Math.min(a.x,b.x)/100);x<=Math.floor(Math.max(a.x,b.x)/100);x++)
    for(let z=Math.floor(Math.min(a.z,b.z)/100);z<=Math.floor(Math.max(a.z,b.z)/100);z++)
      for(const building of sightCells.get(`${x}:${z}`)||[])found.add(building);
  return found;
}
export function lineOfSight(a, c) {
  const dx = c.x - a.x,
    dz = c.z - a.z;
  for (const b of sightCandidates(a,c)) {
    if (
      b.h < 1.2 ||
      Math.max(a.x, c.x) < b.minX ||
      Math.min(a.x, c.x) > b.maxX ||
      Math.max(a.z, c.z) < b.minZ ||
      Math.min(a.z, c.z) > b.maxZ
    )
      continue;
    if((b.minHeight??0)>1.8)continue;
    const solidAt=p=>insidePolygon(p.x,p.z,b.p)&&!(b.holes??[]).some(h=>insidePolygon(p.x,p.z,h));
    if (solidAt(a) || solidAt(c))
      return false;
    for(const ring of [b.p,...(b.holes??[])])for (let i = 0; i < ring.length; i++) {
      const u = ring[i],
        v = ring[(i + 1) % ring.length],
        sx = v[0] - u[0],
        sz = v[1] - u[1],
        cross = dx * sz - dz * sx;
      if (Math.abs(cross) < 1e-8) continue;
      const t = ((u[0] - a.x) * sz - (u[1] - a.z) * sx) / cross,
        q = ((u[0] - a.x) * dz - (u[1] - a.z) * dx) / cross;
      if (t >= 0 && t <= 1 && q >= 0 && q <= 1) return false;
    }
  }
  return true;
}
export function cameraDistance(x, z, y, yaw, wanted, pitch) {
  const dx = Math.sin(yaw) * wanted,
    dz = Math.cos(yaw) * wanted;
  let fraction = 1;
  for (const b of sightCandidates({x,z},{x:x+dx,z:z+dz})) {
    if (
      Math.max(x, x + dx) < b.minX ||
      Math.min(x, x + dx) > b.maxX ||
      Math.max(z, z + dz) < b.minZ ||
      Math.min(z, z + dz) > b.maxZ
    )
      continue;
    for(const ring of [b.p,...(b.holes??[])])for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        c = ring[(i + 1) % ring.length],
        sx = c[0] - a[0],
        sz = c[1] - a[1],
        cross = dx * sz - dz * sx;
      if (Math.abs(cross) < 0.0001) continue;
      const t = ((a[0] - x) * sz - (a[1] - z) * sx) / cross,
        u = ((a[0] - x) * dz - (a[1] - z) * dx) / cross;
      if (
        t > 0.01 &&
        t < fraction &&
        u >= 0 &&
        u <= 1 &&
        y + (2.4 + pitch * wanted) * t < b.h &&
        y + (2.4 + pitch * wanted) * t > (b.minHeight??0)
      )
        fraction = t;
    }
  }
  return Math.max(1.15, wanted * fraction - 0.5);
}
for (const b of collisionBuildings) {
  if((b.minHeight??0)>1.8)continue;
  const xs = b.p.map((p) => p[0]),
    zs = b.p.map((p) => p[1]);
  for (
    let x = Math.floor((Math.min(...xs) - 3) / 40);
    x <= Math.floor((Math.max(...xs) + 3) / 40);
    x++
  )
    for (
      let z = Math.floor((Math.min(...zs) - 3) / 40);
      z <= Math.floor((Math.max(...zs) + 3) / 40);
      z++
    ) {
      const key = `${x},${z}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(b);
    }
}
export function collide(entity, radius) {
  let hit = false;
  const polys = [...(cells.get(`${Math.floor(entity.x / 40)},${Math.floor(entity.z / 40)}`)||[]),...shopObstaclesNear(entity.x,entity.z)];
  for (const building of polys) {
    const p=building.p,holes=building.holes??[];
    let q = null,
      d = Infinity;
    for(const ring of [p,...holes])for (let i = 0; i < ring.length; i++) {
      const c = closest(entity.x, entity.z, ring[i], ring[(i + 1) % ring.length]);
      const n = Math.hypot(entity.x - c[0], entity.z - c[1]);
      if (n < d) {
        d = n;
        q = c;
      }
    }
    const inside = insidePolygon(entity.x, entity.z, p)&&!holes.some(h=>insidePolygon(entity.x,entity.z,h));
    if (q && (inside || d < radius)) {
      let nx = entity.x - q[0],
        nz = entity.z - q[1];
      const l = Math.hypot(nx, nz) || 1;
      nx /= l;
      nz /= l;
      if (inside) {
        nx = -nx;
        nz = -nz;
      }
      entity.x = q[0] + nx * (radius + 0.02);
      entity.z = q[1] + nz * (radius + 0.02);
      hit = true;
    }
  }
  // River banks block driving and walking; mapped road/foot bridges remain open.
  for (const water of waterCells.get(`${Math.floor(entity.x/40)},${Math.floor(entity.z/40)}`)??[]) {
    const q = closest(entity.x, entity.z, water.a, water.b),
      dx = entity.x - q[0],
      dz = entity.z - q[1],
      d = Math.hypot(dx, dz),
      limit = water.width / 2 + radius;
    if (d >= limit) continue;
    const nearRoad =
      roadCells.get(
        `${Math.floor(entity.x / 40)},${Math.floor(entity.z / 40)}`
      ) || [];
    const crossing = nearRoad.some((r) => {
      const p = closest(entity.x, entity.z, r.a, r.b);
      return Math.hypot(entity.x - p[0], entity.z - p[1]) < r.w / 2 + 0.8;
    });
    if (crossing) continue;
    const nx = d > 0.01 ? dx / d : 0,
      nz = d > 0.01 ? dz / d : 1;
    entity.x = q[0] + nx * (limit + 0.03);
    entity.z = q[1] + nz * (limit + 0.03);
    hit = true;
  }
  for(const lake of lakeCandidates(entity.x,entity.z)){
    const roads=roadCells.get(`${Math.floor(entity.x/40)},${Math.floor(entity.z/40)}`)||[];
    if(roads.some(r=>r.bridge&&Math.hypot(entity.x-closest(entity.x,entity.z,r.a,r.b)[0],entity.z-closest(entity.x,entity.z,r.a,r.b)[1])<r.w/2+.8))continue;
    const inside=insidePolygon(entity.x,entity.z,lake.p)&&!lake.holes.some(h=>insidePolygon(entity.x,entity.z,h));
    let near=null,distance=Infinity;
    for(const ring of [lake.p,...lake.holes])for(let i=0;i<ring.length;i++){
      const q=closest(entity.x,entity.z,ring[i],ring[(i+1)%ring.length]),d=Math.hypot(entity.x-q[0],entity.z-q[1]);
      if(d<distance){near=q;distance=d;}
    }
    if(near&&(inside||distance<radius)){
      const sign=inside?-1:1,dx=entity.x-near[0],dz=entity.z-near[1],length=Math.hypot(dx,dz)||1;
      entity.x=near[0]+sign*dx/length*(radius+.03);entity.z=near[1]+sign*dz/length*(radius+.03);hit=true;
    }
  }
  const b = WORLD.bounds,
    x = entity.x,
    z = entity.z;
  entity.x = clamp(x, b[0] + 4, b[2] - 4);
  entity.z = clamp(z, b[1] + 4, b[3] - 4);
  return hit || x !== entity.x || z !== entity.z;
}
export function sanitizeInput(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
  const number = (v, min, max) =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : 0;
  return {
    x: number(raw.x, -1, 1),
    y: number(raw.y, -1, 1),
    yaw: number(raw.yaw, -Math.PI * 2, Math.PI * 2),
    fast: raw.fast === true,
    brake: raw.brake === true,
    fire: raw.fire === true,
    seq: Math.max(0, Math.floor(number(raw.seq, 0, Number.MAX_SAFE_INTEGER)))
  };
}
const vehicle = (id, x, z, heading, model = 'sedan') => ({
  id,
  x,
  z,
  heading,
  model,
  speed: 0,
  vx: 0,
  vz: 0,
  steering: 0,
  driver: null
});
export function createState(
  members,
  missionId = 'first-shift',
  mode = 'solo',
  sport = false,
  difficulty = 'normal'
) {
  const mission =
    missionId === FREE_ROAM.id
      ? FREE_ROAM
      : MISSIONS.find((m) => m.id === missionId) || MISSIONS[0];
  const state = {
    worldVersion:WORLD.regionalSource?.sha256,
    difficulty: ['easy', 'normal', 'hard'].includes(difficulty)
      ? difficulty
      : 'normal',
    elapsed: 0,
    phase: 'active',
    missionId: mission.id,
    mode,
    players: {},
    cars: [],
    traffic: [],
    rival: null,
    winner: null,
    message: 'Find your ride. Follow the lime route.',
    teamIndex: 0
  };
  members.forEach((m, i) => addPlayer(state, m, i, sport));
  for (const [i, id] of ['rinia', 'pyramid', 'blloku', 'mother'].entries()) {
    const place = landmark(id),
      n = nearestNode(place.x - 70, place.z),
      p = point(n),
      to = links[n][0]?.[0] ?? n;
    const heading = Math.atan2(p.x - nodes[to][0], p.z - nodes[to][1]);
    const car = vehicle(
      `parked-${i}`,
      p.x + Math.cos(heading) * 2.5,
      p.z - Math.sin(heading) * 2.5,
      heading,
      i % 2 ? 'taxi' : 'sedan'
    );
    collide(car, 1.35);
    state.cars.push(car);
  }
  // Every Racing Royal class is an enterable city car; reuse the same catalog.
  KARTS.forEach((kart,i)=>{
    const n=(spawnNode+37*(i+1))%nodes.length,p=point(n),to=links[n][0]?.[0]??n;
    const heading=Math.atan2(p.x-nodes[to][0],p.z-nodes[to][1]);
    const car=vehicle(`royal-${kart.id}`,p.x+Math.cos(heading)*2.8,p.z-Math.sin(heading)*2.8,heading,'sport');
    car.racingAsset=kart.id;collide(car,1.35);state.cars.push(car);
  });
  // All ten originals are enterable parked cars in checked city locations.
  for (const placement of COLLECTION_PLACEMENTS) {
    const car=vehicle(placement.id,placement.x,placement.z,placement.heading,'sedan');
    car.collectionVehicle=placement.collectionVehicle;car.npcDriver=true;
    state.cars.push(car);
  }
  populateTraffic(state, SPAWN);
  if (mission.type === 'race') {
    let from = nearestNode(SPAWN.x, SPAWN.z),
      path = [];
    for (const s of mission.stops) {
      const to = nearestNode(s.x, s.z);
      path.push(...route(from, to));
      from = to;
    }
    state.rival = {
      ...vehicle(
        'rival',
        SPAWN.x - Math.cos(initialHeading) * 3.5,
        SPAWN.z + Math.sin(initialHeading) * 3.5,
        initialHeading,
        'sedan-sports'
      ),
      path,
      pathIndex: 0,
      index: 0,
      finished: false,
      delay: 10
    };
  }
  initCityLife(state, lifeEnvironment, mission);
  initAirMobility(state, WORLD);
  return state;
}
export function addPlayer(
  state,
  member,
  slot = Object.keys(state.players).length,
  sport = false
) {
  if (state.players[member.id]) return;
  if (Object.keys(state.players).length >= MAX_PLAYERS)
    throw Error('This city room is full.');
  // Put each parked car along the road; resolve its collision before placing the driver.
  const c = vehicle(
    `car-${member.id}`,
    SPAWN.x - Math.sin(initialHeading) * slot * 6,
    SPAWN.z - Math.cos(initialHeading) * slot * 6,
    initialHeading,
    sport ? 'sedan-sports' : 'sedan'
  );
  collide(c, 1.4);
  state.cars.push(c);
  const p = {
    id: member.id,
    name: String(member.name || 'Driver').slice(0, 18),
    x: c.x + Math.cos(initialHeading) * 2.8,
    z: c.z - Math.sin(initialHeading) * 2.8,
    heading: initialHeading,
    speed: 0,
    carId: null,
    index: 0,
    finished: false,
    failed: false,
    finishTime: null,
    heat: 0,
    input: emptyInput(),
    inputAt: 0,
    lastAction: 0
  };
  collide(p, 0.4);
  equipStarter(p);
  state.players[p.id] = p;
}
export function removePlayer(state, id) {
  const p = state.players[id];
  if (p?.carId) {
    const c = state.cars.find((c) => c.id === p.carId);
    if (c) c.driver = null;
  }
  delete state.players[id];
  state.cars = state.cars.filter((c) => c.id !== `car-${id}` || c.driver);
}
export function control(state, id, raw) {
  const p = state.players[id];
  if (!p) return;
  const i = sanitizeInput(raw);
  if (i.seq < p.input.seq) return;
  p.input = i;
  p.inputAt = state.elapsed;
}
export function interact(state, id, action) {
  const p = state.players[id];
  if (!p || p.health <= 0 || p.finished || p.failed) return;
  if (airAction(state, p, action) || lifeAction(state, p, action)) return;
  if (state.elapsed - p.lastAction < 0.3) return;
  p.lastAction = state.elapsed;
  if (action === 'recover') {
    const v = p.carId ? state.cars.find((c) => c.id === p.carId) : p;
    const s = roadPoint(v.x, v.z);
    v.x = s.x;
    v.z = s.z;
    v.speed = 0;
    v.vx = 0;
    v.vz = 0;
    collide(v, p.carId ? 1.4 : 0.4);
    p.x = v.x;
    p.z = v.z;
    p.heat = Math.min(p.heat + 0.08, 0.9);
    return;
  }
  if (action !== 'vehicle') return;
  if (p.carId) {
    const c = state.cars.find((c) => c.id === p.carId);
    if (!c || Math.abs(c.speed) > 2.5) return;
    p.x = c.x + Math.cos(c.heading) * 2.8;
    p.z = c.z - Math.sin(c.heading) * 2.8;
    collide(p, 0.4);
    c.driver = null;
    p.carId = null;
    p.speed = 0;
  } else {
    const c = [...state.cars,...state.traffic]
      .filter((c) => !c.driver && Math.abs(c.speed)<2.5)
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (c && distance(c, p) < 7) {
      const ti=state.traffic.indexOf(c);if(ti>=0){state.traffic.splice(ti,1);state.cars.push(c);}
      p.carId = c.id;
      c.driver = id;
      c.npcDriver=false;
      if(c.collectionVehicle)c.npcDriver=false;
      p.x = c.x;
      p.z = c.z;
      p.heading = c.heading;
    }
  }
}
export function movePlayer(state, p, dt) {
  const input =
    state.elapsed - p.inputAt > 0.45
      ? { ...emptyInput(), brake: true }
      : p.input;
  if (p.finished || p.failed || p.health <= 0) return;
  if (p.aircraftId) return;
  if (p.carId) {
    const c = state.cars.find((c) => c.id === p.carId);
    if (!c) {
      p.carId = null;
      return;
    }
    c.steering += (input.x - c.steering) * Math.min(1, dt * 8);
    const bus=c.model==='tirana-bus';
    let accel = input.y * (input.y * c.speed < 0 ? (bus?9:26) : bus?3.2:10.5);
    if (input.brake) accel -= Math.sign(c.speed) * 30;
    c.speed += accel * dt;
    c.speed *= Math.exp(-(input.y === 0 ? 1.25 : 0.12) * dt);
    c.speed = clamp(c.speed, -7, bus ? 16 : c.model === 'sedan-sports' ? 32 : 24);
    // Positive steering is screen-right when the chase camera faces forward.
    c.heading = angle(
      c.heading -
        ((c.steering * c.speed) / ((bus?7:2.8) + Math.abs(c.speed) * 0.55)) * dt
    );
    const grip = input.brake ? 3 : 10;
    c.vx += (-Math.sin(c.heading) * c.speed - c.vx) * Math.min(1, dt * grip);
    c.vz += (-Math.cos(c.heading) * c.speed - c.vz) * Math.min(1, dt * grip);
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    let wallHit=collide(c,bus?1.3:1.35);
    if(bus){for(const offset of [-7.5,7.5]){const q={x:c.x+Math.sin(c.heading)*offset,z:c.z+Math.cos(c.heading)*offset},x=q.x,z=q.z;if(collide(q,1.3)){c.x+=q.x-x;c.z+=q.z-z;wallHit=true;}}c.trailerHeading=(c.trailerHeading??c.heading)+angle(c.heading-(c.trailerHeading??c.heading))*Math.min(1,dt*Math.max(.35,Math.abs(c.speed)/7));}
    if (wallHit) {
      c.speed *= 0.55;
      c.vx *= 0.3;
      c.vz *= 0.3;
    }
    for (const o of [...state.cars, ...state.traffic]) {
      if (o.id === c.id) continue;
      if(bus||o.model==='tirana-bus'){
        const separation=vehicleSeparation(c,o);if(separation){c.x+=separation.x;c.z+=separation.z;c.speed*=.65;c.vx*=.5;c.vz*=.5;}continue;
      }
      const d = distance(c, o);
      const radius=2.8;
      if (d < radius && d > 0.01) {
        c.x += ((c.x - o.x) / d) * (radius - d);
        c.z += ((c.z - o.z) / d) * (radius - d);
        c.speed *= 0.85;
      }
    }
    p.x = c.x;
    p.z = c.z;
    p.heading = c.heading;
    p.speed = c.speed;
  } else {
    const l = Math.max(1, Math.hypot(input.x, input.y)),
      speed = input.fast ? 7.2 : 4.2;
    const vx =
      ((Math.cos(input.yaw) * input.x - Math.sin(input.yaw) * input.y) *
        speed) /
      l;
    const vz =
      ((-Math.sin(input.yaw) * input.x - Math.cos(input.yaw) * input.y) *
        speed) /
      l;
    p.x += vx * dt;
    p.z += vz * dt;
    p.speed = Math.hypot(vx, vz);
    if (p.speed > 0.1) p.heading = Math.atan2(-vx, -vz);
    collide(p, 0.4);
  }
}
function along(v, target, speed, dt) {
  const dx = target.x - v.x,
    dz = target.z - v.z,
    d = Math.hypot(dx, dz);
  if (d < 0.02) {v.speed=0;return true;}
  const move = Math.min(d, speed * dt);
  v.x += (dx / d) * move;
  v.z += (dz / d) * move;
  v.heading = Math.atan2(-dx, -dz);
  v.speed = speed;
  return d <= speed * dt + 0.1;
}
export function stepState(state, dt = STEP, systems) {
  if (state.phase !== 'active') return;
  dt = clamp(dt, 0, 0.05);
  state.elapsed += dt;
  const mission =
    state.missionId === FREE_ROAM.id
      ? FREE_ROAM
      : MISSIONS.find((m) => m.id === state.missionId);
  updateAirMobility(state, dt);
  for (const p of Object.values(state.players)) (systems?.movePlayer || movePlayer)(state, p, dt);
  updateEmergencyResponse(state,dt,lifeEnvironment);
  updateTraffic(state, dt, (npc, damage, car) => harm(state, npc, damage, car, systems?.life ? {...lifeEnvironment,...systems.life} : lifeEnvironment));
  updateCityLife(state, dt, systems?.life ? {...lifeEnvironment, ...systems.life} : lifeEnvironment, mission);
  systems?.afterLife?.(state, dt);
  const rival = state.rival;
  if (rival && state.elapsed > rival.delay) {
    if (mission.type === 'pursuit') {
      const target = Object.values(state.players)
        .filter((p) => !p.finished && !p.failed)
        .sort((a, b) => distance(a, rival) - distance(b, rival))[0];
      if (target && state.elapsed >= rival.nextRoute) {
        rival.path = route(
          nearestNode(rival.x, rival.z),
          nearestNode(target.x, target.z)
        );
        rival.pathIndex = 0;
        rival.nextRoute = state.elapsed + 3;
      }
    }
    if (
      rival.path[rival.pathIndex] &&
      along(
        rival,
        rival.path[rival.pathIndex],
        mission.type === 'race'
          ? 12 * difficultyOf(state.difficulty).rival
          : 10.5,
        dt
      )
    )
      rival.pathIndex++;
    if (mission.type === 'race') {
      if (
        mission.stops[rival.index] &&
        distance(rival, mission.stops[rival.index]) < 13
      )
        rival.index++;
      if (rival.index === mission.stops.length) rival.finished = true;
    }
  }
  for (const p of Object.values(state.players)) {
    if (mission.type === 'free') continue;
    if (p.finished || p.failed) continue;
    const idx = state.mode === 'coop' ? state.teamIndex : p.index,
      target = mission.stops[idx];
    if (
      target &&
      (!systems?.canAdvanceObjective || systems.canAdvanceObjective(state, p, mission, target)) &&
      !(mission.type === 'combat' && state.objectiveRemaining > 0) &&
      distance(p, target) < (mission.type === 'delivery' ? 12 : 17) &&
      (mission.type !== 'delivery' || Math.abs(p.speed) < 2.5)
    ) {
      p.index++;
      if (state.mode === 'coop') {
        state.teamIndex++;
        for (const m of Object.values(state.players)) m.index = state.teamIndex;
      }
    }
    if (p.index >= mission.stops.length) {
      p.finished = true;
      p.finishTime = state.elapsed;
      if (!state.winner) state.winner = p.id;
      state.message =
        state.mode === 'coop'
          ? 'Crew job complete.'
          : `${p.name} finished the route.`;
    }
    if (
      !p.finished &&
      (state.elapsed > mission.time * difficultyOf(state.difficulty).time ||
        (rival?.finished && state.mode !== 'rivals'))
    ) {
      p.failed = true;
      state.message = rival?.finished
        ? 'Ardi reached the finish first.'
        : 'Shift ended. Give the route another try.';
    }
  }
  if (
    Object.values(state.players).length &&
    Object.values(state.players).every((p) => p.finished || p.failed)
  )
    state.phase = 'finished';
}
export function advanceState(state, seconds, systems) {
  let remaining = clamp(seconds, 0, 2);
  while (remaining > 0) {
    const dt = Math.min(STEP, remaining);
    stepState(state, dt, systems);
    remaining -= dt;
  }
}
export function awardCareer(career, state, id) {
  const p = state.players[id],
    m = MISSIONS.find((m) => m.id === state.missionId);
  if (!p?.finished || p.failed || !m) return career;
  const c = structuredClone(career);
  if (!c.completed.includes(m.id)) {
    c.completed.push(m.id);
    c.credits += Math.round(m.reward * difficultyOf(state.difficulty).reward);
  }
  c.best[m.id] = Math.min(c.best[m.id] ?? Infinity, p.finishTime);
  return c;
}
export function navigation(state, id) {
  const p = state.players[id],
    m = MISSIONS.find((m) => m.id === state.missionId);
  if (!p) return [];
  if (!m) return [];
  const s = m.stops[p.index];
  if (!s) return [];
  return route(nearestNode(p.x, p.z), nearestNode(s.x, s.z));
}
// D1 can retain a run created by the previous game version. Upgrade that run
// without deleting the room, changing its owner or resetting chapter progress.
export function upgradeState(state) {
  // Expanded source snapshots preserve coordinates, but regional graph indices
  // change. Rebind persisted traffic before it resumes an old room/save.
  if(state.worldVersion!==WORLD.regionalSource?.sha256){
    for(const car of state.traffic||[]){car.node=nearestNode(car.x,car.z);car.next=links[car.node][0]?.[0]??car.node;car.responsePath=[];car.responseGoal=undefined;car.nextResponseRoute=0;car.homeNode=car.node;}
    for(const unit of state.units||[]){unit.path=[];unit.pathIndex=0;unit.nextRoute=0;}
    state.worldVersion=WORLD.regionalSource?.sha256;
  }
  if (state.lifeVersion === 2) {
    if(!state.populationVersion){initCityPopulation(state,lifeEnvironment);populateTraffic(state,SPAWN);}
    return state;
  }
  state.difficulty ||= 'normal';
  for (const p of Object.values(state.players))
    if (!p.inventory) equipStarter(p);
  const mission = MISSIONS.find((m) => m.id === state.missionId) || FREE_ROAM;
  if (mission.type === 'pursuit') state.rival = null;
  initCityLife(state, lifeEnvironment, mission);
  return state;
}
export function publicState(state) {
  const s = structuredClone(state);
  for (const p of Object.values(s.players)) {
    delete p.input;
    delete p.inputAt;
    delete p.lastAction;
  }
  for (const n of s.npcs || []) {
    delete n.path;
    delete n.origin;
    delete n.nextShot;
  }
  for (const u of s.units || []) {
    delete u.path;
    delete u.nextRoute;
  }
  for(const car of s.traffic||[]){delete car.responsePath;delete car.nextResponseRoute;delete car.responseIndex;}
  if (s.rival) {
    delete s.rival.path;
    delete s.rival.nextRoute;
  }
  return s;
}

const lifeEnvironment = {
  world: WORLD,
  spawn: SPAWN,
  collide,
  emptyInput,
  roadPoint,
  nearestNode,
  route,
  along,
  clear: lineOfSight
};
