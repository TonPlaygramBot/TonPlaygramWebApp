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
export const buildings = WORLD.buildings.map((b, i) => {
  const footprint = b.p.map((p) => [p[0] - ORIGIN.x, p[1] - ORIGIN.z]);
  const xs = footprint.map((p) => p[0]),
    zs = footprint.map((p) => p[1]);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2,
    z = (Math.min(...zs) + Math.max(...zs)) / 2;
  const road = nearestRoad(x, z);
  // The existing right-hand facade faces -X. Turn that facade toward its street.
  const rot = Math.atan2(road.z - z, -(road.x - x));
  return {
    id: b.id,
    x,
    z,
    rot,
    template: i % 10,
    footprint,
    w: 11,
    d: 12,
    h: 24
  };
});
const s = nearestRoad(0, 0);
export const START = Object.freeze({ x: s.x, z: s.z });
export const SPAWNS = Object.freeze(
  Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4,
      p = nearestRoad(START.x + Math.sin(a) * 48, START.z + Math.cos(a) * 48);
    return Object.freeze({ x: p.x, z: p.z });
  })
);
const exit = nearestRoad(START.x, START.z - 65);
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
export const OBSTACLES = Object.freeze([...buildings, ...props]);
