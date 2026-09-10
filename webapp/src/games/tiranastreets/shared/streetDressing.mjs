import { WORLD } from './world.mjs';
import {BUS_STOPS} from '../../tirana-street-life/transitData.mjs';
import {
  SIGNALS,
  SHOP,
  onCarriageway,
  pavementHeight,
  segmentDistance
} from './streetLayout.mjs';
import { RIVER_SEGMENTS, freeLandscape, nearBridge } from './landscape.mjs';

// Original city dressing, not a claim that each fixture exists at this OSM location.
// The same footprints are consumed by the scene and the authoritative simulation.
export const STREET_PROPS = [];
const dimensions = {
  bus_shelter: [2.14, 0.9],
  bicycle_rack: [0.98, 0.37],
  utility_cabinet: [0.52, 0.3],
  stone_planter: [0.62, 0.62],
  hydrant: [0.32, 0.22]
};
const worldPoint = (p, x, z) => ({
  x: p.x + Math.cos(p.yaw) * x + Math.sin(p.yaw) * z,
  z: p.z - Math.sin(p.yaw) * x + Math.cos(p.yaw) * z
});
function fits(p) {
  const [w, d] = dimensions[p.name];
  if (
    nearBridge(p.x, p.z, 7) ||
    Math.hypot(p.x - SHOP.x, p.z - SHOP.z) < 15 ||
    SIGNALS.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < s.width / 2 + 8)
  )
    return false;
  if (
    STREET_PROPS.some(
      (q) =>
        Math.hypot(q.x - p.x, q.z - p.z) < (p.name === 'bus_shelter' ? 9 : 5)
    )
  )
    return false;
  return [
    [0, 0],
    [-w, -d],
    [w, -d],
    [w, d],
    [-w, d]
  ].every(([x, z]) => {
    const q = worldPoint(p, x, z);
    return (
      freeLandscape(q.x, q.z) &&
      pavementHeight(q.x, q.z) > 0.2 &&
      !RIVER_SEGMENTS.some(
        (r) => segmentDistance(q.x, q.z, r.a, r.b) < r.width / 2 + 1
      )
    );
  });
}

for (const [i, r] of WORLD.roads.entries()) {
  const dx = r.b[0] - r.a[0],
    dz = r.b[1] - r.a[1],
    len = Math.hypot(dx, dz);
  if (r.walk || r.bridge || len < 26) continue;
  const ux = dx / len,
    uz = dz / len;
  for (const side of [-1, 1]) {
    const canShelter = false; // Mapped stops are owned by StreetLifeLayer.
    const name = canShelter
      ? 'bus_shelter'
      : ['utility_cabinet', 'hydrant', 'stone_planter', 'bicycle_rack'][i % 4];
    if (!canShelter && i % 3 !== 0) continue;
    const off = r.w / 2 + (name === 'bus_shelter' ? 1.45 : 1.72);
    const p = {
      name,
      x: r.a[0] + dx * 0.52 + uz * off * side,
      z: r.a[1] + dz * 0.52 - ux * off * side,
      yaw: Math.atan2(-uz * side, ux * side),
      scale: 1
    };
    if (fits(p)) {
      STREET_PROPS.push(p);

    }
  }
  if (i % 11 === 0 && len > 36)
    STREET_PROPS.push({
      name: 'manhole_cover',
      x: r.a[0] + dx * 0.42,
      z: r.a[1] + dz * 0.42,
      yaw: Math.atan2(dx, dz),
      scale: 1
    });
}
for (const s of SIGNALS)
  for (const side of [-1, 1]) {
    const p = {
      name: 'tactile_tile',
      x:
        s.x +
        Math.cos(s.yaw) * (s.width / 2 + 0.7) * side -
        Math.sin(s.yaw) * 2.1,
      z:
        s.z -
        Math.sin(s.yaw) * (s.width / 2 + 0.7) * side -
        Math.cos(s.yaw) * 2.1,
      yaw: s.yaw + Math.PI / 2,
      scale: 1
    };
    if (!onCarriageway(p.x, p.z, 0.08) && freeLandscape(p.x, p.z))
      STREET_PROPS.push(p);
  }
export const STREET_SOLIDS = [];
for (const p of STREET_PROPS) {
  if (!dimensions[p.name]) continue;
  const boxes =
    p.name === 'bus_shelter'
      ? [
          [-2.02, -0.78, -1.88, 0.78],
          [1.88, -0.78, 2.02, 0.78],
          [-1.9, -0.77, 1.9, -0.67],
          [-1.28, -0.68, 1.28, -0.15]
        ]
      : [
          [
            -dimensions[p.name][0],
            -dimensions[p.name][1],
            dimensions[p.name][0],
            dimensions[p.name][1]
          ]
        ];
  for (const box of boxes) STREET_SOLIDS.push({ ...p, box });
}
// Physical backs, sides, poles and benches of the mapped stop models. Open
// fronts stay traversable; no solid rectangle around the whole shelter.
for (const stop of BUS_STOPS) {
  const boxes=[[-.045,.075,.045,.165]];
  if(stop.shelter)boxes.push([-1.79,-1.28,-1.71,-.1],[1.71,-1.28,1.79,-.1],[-1.72,-1.26,1.72,-1.22]);
  if(stop.bench)boxes.push([-.85,-1.09,.85,-.65]);
  for(const box of boxes)STREET_SOLIDS.push({name:'bus_shelter',sourceId:stop.id,x:stop.x,z:stop.z,yaw:stop.yaw,scale:1,box});
}
const cells = new Map();
for (const s of STREET_SOLIDS)
  for (let x = Math.floor((s.x - 5) / 32); x <= Math.floor((s.x + 5) / 32); x++)
    for (
      let z = Math.floor((s.z - 5) / 32);
      z <= Math.floor((s.z + 5) / 32);
      z++
    ) {
      const key = `${x},${z}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(s);
    }
export function collideStreetProps(p, radius) {
  let hit = false;
  for (const s of cells.get(
    `${Math.floor(p.x / 32)},${Math.floor(p.z / 32)}`
  ) || []) {
    const cos = Math.cos(s.yaw),
      sin = Math.sin(s.yaw),
      dx = p.x - s.x,
      dz = p.z - s.z;
    const x = dx * cos - dz * sin,
      z = dx * sin + dz * cos,
      [a, b, c, d] = s.box;
    let qx = Math.max(a, Math.min(c, x)),
      qz = Math.max(b, Math.min(d, z));
    const distance = Math.hypot(x - qx, z - qz);
    if (distance >= radius) continue;
    hit = true;
    if (distance > 0.0001) {
      qx += ((x - qx) * (radius + 0.005)) / distance;
      qz += ((z - qz) * (radius + 0.005)) / distance;
    } else {
      const edge = [
        [x - a, a - radius, z],
        [c - x, c + radius, z],
        [z - b, x, b - radius],
        [d - z, x, d + radius]
      ].sort((u, v) => u[0] - v[0])[0];
      qx = edge[1];
      qz = edge[2];
    }
    Object.assign(p, worldPoint(s, qx, qz));
  }
  return hit;
}
