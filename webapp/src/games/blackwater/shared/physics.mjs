export { MAP, EXTRACTION } from './layout.mjs';
import { MAP } from './layout.mjs';
export const WEAPONS = Object.freeze({
  ar: {
    name: 'MK18',
    role: 'ASSAULT RIFLE',
    mag: 30,
    damage: 34,
    interval: 0.12,
    reload: 1.65,
    spread: 0.004,
    recoil: 0.017
  },
  smg: {
    name: 'MP9',
    role: 'SUBMACHINE GUN',
    mag: 36,
    damage: 25,
    interval: 0.075,
    reload: 1.3,
    spread: 0.007,
    recoil: 0.012
  }
});
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const indices = new WeakMap();
function nearby(x, z, r, obstacles) {
  let grid = indices.get(obstacles);
  if (!grid) {
    grid = new Map();
    for (const o of obstacles) {
      const size = Math.hypot(o.w, o.d) / 2;
      for (
        let ix = Math.floor((o.x - size) / 20);
        ix <= Math.floor((o.x + size) / 20);
        ix++
      )
        for (
          let iz = Math.floor((o.z - size) / 20);
          iz <= Math.floor((o.z + size) / 20);
          iz++
        ) {
          const key = ix + ',' + iz;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(o);
        }
    }
    indices.set(obstacles, grid);
  }
  const result = new Set();
  for (let ix = Math.floor((x - r) / 20); ix <= Math.floor((x + r) / 20); ix++)
    for (
      let iz = Math.floor((z - r) / 20);
      iz <= Math.floor((z + r) / 20);
      iz++
    )
      for (const o of grid.get(ix + ',' + iz) || []) result.add(o);
  return result;
}
export function collides(x, z, r, obstacles) {
  if (
    x < MAP.minX + r ||
    x > MAP.maxX - r ||
    z < MAP.minZ + r ||
    z > MAP.maxZ - r
  )
    return true;
  for (const o of nearby(x, z, r, obstacles)) {
    const c = Math.cos(o.rot || 0),
      s = Math.sin(o.rot || 0),
      px = c * (x - o.x) - s * (z - o.z),
      pz = s * (x - o.x) + c * (z - o.z),
      dx = px - clamp(px, -o.w / 2, o.w / 2),
      dz = pz - clamp(pz, -o.d / 2, o.d / 2);
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}
export function moveCircle(p, dx, dz, r, obstacles) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.16));
  for (let i = 0; i < steps; i++) {
    if (!collides(p.x + dx / steps, p.z, r, obstacles)) p.x += dx / steps;
    if (!collides(p.x, p.z + dz / steps, r, obstacles)) p.z += dz / steps;
  }
}
export function rayBox(origin, dir, o) {
  const c = Math.cos(o.rot || 0),
    s = Math.sin(o.rot || 0),
    ox = origin.x - o.x,
    oz = origin.z - o.z;
  const local = { x: c * ox - s * oz, y: origin.y, z: s * ox + c * oz },
    d = { x: c * dir.x - s * dir.z, y: dir.y, z: s * dir.x + c * dir.z };
  let near = 0,
    far = 1e6;
  for (const [axis, min, max] of [
    ['x', -o.w / 2, o.w / 2],
    ['y', 0, o.h],
    ['z', -o.d / 2, o.d / 2]
  ]) {
    if (Math.abs(d[axis]) < 1e-8) {
      if (local[axis] < min || local[axis] > max) return Infinity;
      continue;
    }
    let a = (min - local[axis]) / d[axis],
      b = (max - local[axis]) / d[axis];
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a);
    far = Math.min(far, b);
    if (near > far) return Infinity;
  }
  return near;
}
export function lineClear(a, b, obstacles) {
  const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  if (length < 0.001) return true;
  const dir = {
    x: (b.x - a.x) / length,
    y: (b.y - a.y) / length,
    z: (b.z - a.z) / length
  };
  return !obstacles.some((o) => rayBox(a, dir, o) < length - 0.15);
}
function walkClear(a, b, r, obstacles) {
  const d = Math.hypot(b.x - a.x, b.z - a.z),
    steps = Math.max(1, Math.ceil(d / 0.3));
  for (let i = 1; i <= steps; i++)
    if (
      collides(
        a.x + ((b.x - a.x) * i) / steps,
        a.z + ((b.z - a.z) * i) / steps,
        r,
        obstacles
      )
    )
      return false;
  return true;
}
// Local bounded A*, in the same metric coordinate system as the complete city.
export function findPath(start, goal, obstacles) {
  if (walkClear(start, goal, 0.42, obstacles))
    return [{ x: goal.x, z: goal.z }];
  const step = 1.5,
    minX = Math.max(MAP.minX, Math.min(start.x, goal.x) - 14),
    minZ = Math.max(MAP.minZ, Math.min(start.z, goal.z) - 14);
  const w = Math.min(
      160,
      Math.ceil((Math.max(start.x, goal.x) + 14 - minX) / step)
    ),
    h = Math.min(
      160,
      Math.ceil((Math.max(start.z, goal.z) + 14 - minZ) / step)
    );
  const cell = (p) => ({
      x: clamp(Math.round((p.x - minX) / step), 0, w - 1),
      z: clamp(Math.round((p.z - minZ) / step), 0, h - 1)
    }),
    point = (x, z) => ({ x: x * step + minX, z: z * step + minZ });
  let s = cell(start);
  const candidates = [];
  for (let dx = -3; dx <= 3; dx++)
    for (let dz = -3; dz <= 3; dz++) {
      const x = s.x + dx,
        z = s.z + dz;
      if (x < 0 || z < 0 || x >= w || z >= h) continue;
      const p = point(x, z);
      if (
        !collides(p.x, p.z, 0.48, obstacles) &&
        walkClear(start, p, 0.34, obstacles)
      )
        candidates.push({ x, z, d: Math.hypot(p.x - start.x, p.z - start.z) });
    }
  if (!candidates.length) return [];
  candidates.sort((a, b) => a.d - b.d);
  s = candidates[0];
  const g = cell(goal),
    key = (x, z) => z * w + x,
    open = [key(s.x, s.z)],
    came = new Map(),
    cost = new Map([[open[0], 0]]),
    closed = new Set();
  let best = open[0],
    bestDist = Infinity;
  for (let iter = 0; open.length && iter < 2400; iter++) {
    let pick = 0,
      score = Infinity;
    for (let i = 0; i < open.length; i++) {
      const k = open[i],
        f =
          (cost.get(k) ?? Infinity) +
          Math.hypot((k % w) - g.x, Math.floor(k / w) - g.z);
      if (f < score) {
        score = f;
        pick = i;
      }
    }
    const current = open.splice(pick, 1)[0],
      cx = current % w,
      cz = Math.floor(current / w);
    closed.add(current);
    const gd = Math.hypot(cx - g.x, cz - g.z);
    if (gd < bestDist) {
      bestDist = gd;
      best = current;
    }
    if (gd < 0.8) break;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const nx = cx + dx,
        nz = cz + dz,
        n = key(nx, nz);
      if (nx < 0 || nx >= w || nz < 0 || nz >= h || closed.has(n)) continue;
      const p = point(nx, nz);
      if (
        collides(p.x, p.z, 0.48, obstacles) ||
        !walkClear(point(cx, cz), p, 0.42, obstacles)
      )
        continue;
      const nc = (cost.get(current) ?? 0) + 1;
      if (nc < (cost.get(n) ?? Infinity)) {
        cost.set(n, nc);
        came.set(n, current);
        if (!open.includes(n)) open.push(n);
      }
    }
  }
  const path = [];
  let current = best;
  while (came.has(current)) {
    path.unshift(point(current % w, Math.floor(current / w)));
    current = came.get(current);
  }
  path.unshift(point(s.x, s.z));
  return path;
}
export const waveCount = (wave) => [0, 4, 6, 8][wave] ?? 8;
export const afterWave = (wave) => (wave >= 3 ? 'extract' : 'upgrade');
export function reloadAmmo(ammo, reserve, capacity) {
  const add = Math.max(0, Math.min(capacity - ammo, reserve));
  return { ammo: ammo + add, reserve: reserve - add };
}
export function createRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
