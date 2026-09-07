import { WORLD } from './world.mjs';
import {
  SHOP,
  SIGNALS,
  onCarriageway,
  segmentDistance
} from './streetLayout.mjs';
// Original OSM waterway plus the missing western reach inferred from mapped bridge centres.
// It is a game channel, not a survey or an extracted Google mesh.
const mapped = WORLD.water.filter((w) => !Array.isArray(w) && w.width >= 8);
const east = mapped.find((w) => w.line.length > 2);
const short = mapped.find((w) => w.line.length === 2);
const lana = east ? [...east.line, ...(short ? short.line.slice(1) : [])] : [];
const west = WORLD.roads
  .filter((r) => r.bridge && Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) > 20)
  .map((r) => [(r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2])
  .filter((p) => p[0] < 0 && p[1] > 400 && p[1] < 650)
  .sort((a, b) => b[0] - a[0]);
for (const p of west)
  if (!lana.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 35))
    lana.push(p);
export const RIVER_PATHS = [
  ...(lana.length ? [{ line: lana, width: 12 }] : []),
  ...WORLD.water.filter((w) => !Array.isArray(w) && w.width < 8)
];
export const RIVER_SEGMENTS = RIVER_PATHS.flatMap((w) =>
  w.line.slice(1).map((b, i) => ({ a: w.line[i], b, width: w.width }))
);
export function offsetPath(line, offset) {
  return line.map((p, i) => {
    const a = line[Math.max(0, i - 1)],
      b = line[Math.min(line.length - 1, i + 1)];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz) || 1;
    return [p[0] + (dz / len) * offset, p[1] - (dx / len) * offset];
  });
}
export function riverOutline(line, halfWidth) {
  return [
    ...offsetPath(line, halfWidth),
    ...offsetPath(line, -halfWidth).reverse()
  ];
}
const bridgeRoads = WORLD.roads.filter((r) => r.bridge);
export const nearBridge = (x, z, margin = 2) =>
  bridgeRoads.some((r) => segmentDistance(x, z, r.a, r.b) < r.w / 2 + margin);
const buildings = WORLD.buildings.map((b) => ({
  p: b.p,
  minX: Math.min(...b.p.map((p) => p[0])),
  maxX: Math.max(...b.p.map((p) => p[0])),
  minZ: Math.min(...b.p.map((p) => p[1])),
  maxZ: Math.max(...b.p.map((p) => p[1]))
}));
export const freeLandscape = (x, z) =>
  !onCarriageway(x, z, 0.4) &&
  Math.hypot(x - SHOP.x, z - SHOP.z) > 11 &&
  !buildings.some(
    (b) =>
      x > b.minX - 0.4 &&
      x < b.maxX + 0.4 &&
      z > b.minZ - 0.4 &&
      z < b.maxZ + 0.4
  );
const walks = WORLD.roads.filter((r) => r.walk);
const walkCells = new Map();
for (const r of walks) {
  const pad = r.w / 2 + 2;
  for (
    let x = Math.floor((Math.min(r.a[0], r.b[0]) - pad) / 32);
    x <= Math.floor((Math.max(r.a[0], r.b[0]) + pad) / 32);
    x++
  )
    for (
      let z = Math.floor((Math.min(r.a[1], r.b[1]) - pad) / 32);
      z <= Math.floor((Math.max(r.a[1], r.b[1]) + pad) / 32);
      z++
    ) {
      const key = `${x},${z}`;
      if (!walkCells.has(key)) walkCells.set(key, []);
      walkCells.get(key).push(r);
    }
}
export const onFootpath = (x, z, margin = 0.7) =>
  (walkCells.get(`${Math.floor(x / 32)},${Math.floor(z / 32)}`) || []).some(
    (r) => segmentDistance(x, z, r.a, r.b) < r.w / 2 + margin
  );
export const RAILINGS = [];
const occupied = new Set();
function addRail(a, b, river = false) {
  const x = (a[0] + b[0]) / 2,
    z = (a[1] + b[1]) / 2;
  const key = `${Math.round(x / 2)},${Math.round(z / 2)}`;
  if (
    occupied.has(key) ||
    ![a, b, [x, z]].every((p) => freeLandscape(...p)) ||
    nearBridge(x, z, 2.8)
  )
    return;
  if (
    !river &&
    (onFootpath(x, z, 1.2) ||
      SIGNALS.some((s) => Math.hypot(s.x - x, s.z - z) < s.width / 2 + 6))
  )
    return;
  occupied.add(key);
  RAILINGS.push({
    a,
    b,
    x,
    z,
    yaw: Math.atan2(b[0] - a[0], b[1] - a[1]),
    length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    river
  });
}
function sections(line, river) {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.max(1, Math.ceil(len / 2.6));
    for (let k = 0; k < count; k++)
      addRail(
        [
          a[0] + ((b[0] - a[0]) * k) / count,
          a[1] + ((b[1] - a[1]) * k) / count
        ],
        [
          a[0] + ((b[0] - a[0]) * (k + 1)) / count,
          a[1] + ((b[1] - a[1]) * (k + 1)) / count
        ],
        river
      );
  }
}
for (const r of RIVER_PATHS.filter((r) => r.width >= 8))
  for (const side of [-1, 1])
    sections(offsetPath(r.line, side * (r.width / 2 + 5.8)), true);
for (const r of WORLD.roads) {
  const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]);
  if (r.walk || r.bridge || r.w < 9 || len < 22) continue;
  for (const side of [-1, 1]) {
    const ux = (r.b[0] - r.a[0]) / len,
      uz = (r.b[1] - r.a[1]) / len,
      off = side * (r.w / 2 + 0.42);
    const a = [r.a[0] + ux * 6 + uz * off, r.a[1] + uz * 6 - ux * off],
      b = [r.b[0] - ux * 6 + uz * off, r.b[1] - uz * 6 - ux * off];
    sections([a, b], false);
  }
}
const railCells = new Map();
for (const r of RAILINGS)
  for (let x = Math.floor((r.x - 5) / 32); x <= Math.floor((r.x + 5) / 32); x++)
    for (
      let z = Math.floor((r.z - 5) / 32);
      z <= Math.floor((r.z + 5) / 32);
      z++
    ) {
      const key = `${x},${z}`;
      if (!railCells.has(key)) railCells.set(key, []);
      railCells.get(key).push(r);
    }
export function collideRailings(p, radius) {
  let hit = false;
  for (const r of railCells.get(
    `${Math.floor(p.x / 32)},${Math.floor(p.z / 32)}`
  ) || []) {
    const dx = r.b[0] - r.a[0],
      dz = r.b[1] - r.a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - r.a[0]) * dx + (p.z - r.a[1]) * dz) / (dx * dx + dz * dz)
      )
    );
    const qx = r.a[0] + dx * t,
      qz = r.a[1] + dz * t,
      nx = p.x - qx,
      nz = p.z - qz,
      d = Math.hypot(nx, nz),
      limit = radius + 0.065;
    if (d >= limit) continue;
    const len = Math.hypot(dx, dz);
    p.x = qx + (d > 0.0001 ? nx / d : dz / len) * (limit + 0.01);
    p.z = qz + (d > 0.0001 ? nz / d : -dx / len) * (limit + 0.01);
    hit = true;
  }
  return hit;
}
export const RIVER_TREES = [];
for (const r of RIVER_PATHS.filter((r) => r.width >= 8))
  for (const side of [-1, 1]) {
    const edge = offsetPath(r.line, side * (r.width / 2 + 9.2));
    let carry = 3;
    for (let i = 1; i < edge.length; i++) {
      const a = edge[i - 1],
        b = edge[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (; carry < len; carry += 13) {
        const x = a[0] + ((b[0] - a[0]) * carry) / len,
          z = a[1] + ((b[1] - a[1]) * carry) / len;
        if (
          freeLandscape(x, z) &&
          !nearBridge(x, z, 3) &&
          !onFootpath(x, z, 0.2)
        )
          RIVER_TREES.push({ x, z });
      }
      carry -= len;
    }
  }
