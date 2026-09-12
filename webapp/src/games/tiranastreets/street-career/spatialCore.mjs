import { detailPostObstacles } from '../../tirana-street-detail/sharedRoadDetails.mjs';
import {shopObstacles} from '../shared/cityPopulation.mjs';
import {vehicleSize} from '../shared/trafficSimulation.mjs';
/** Headless 3D queries over the SAME city footprints as the shared simulation.
 * No scene objects or renderer callbacks can affect a hit or clearance result. */
import {
  collisionSolids,
  WORLD,
  insidePolygon,
  collide
} from '../shared/engine.mjs';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const direction3 = (yaw, pitch) => ({
  x: -Math.sin(yaw) * Math.cos(pitch),
  y: Math.sin(pitch),
  z: -Math.cos(yaw) * Math.cos(pitch)
});
export const pointAlong = (a, d, t) => ({
  x: a.x + d.x * t,
  y: a.y + d.y * t,
  z: a.z + d.z * t
});
export function rayBox(a, d, b, max = Infinity) {
  let lo = 0,
    hi = max;
  for (const k of ['x', 'y', 'z']) {
    if (Math.abs(d[k]) < 1e-9) {
      if (a[k] < b.min[k] || a[k] > b.max[k]) return null;
    } else {
      let x = (b.min[k] - a[k]) / d[k],
        y = (b.max[k] - a[k]) / d[k];
      if (x > y) [x, y] = [y, x];
      lo = Math.max(lo, x);
      hi = Math.min(hi, y);
      if (lo > hi) return null;
    }
  }
  return lo;
}
const nearest = (x, z, a, b) => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = clamp(
      ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1),
      0,
      1
    );
  return [a[0] + dx * t, a[1] + dz * t];
};
const solidAt = (b, x, z) =>
  insidePolygon(x, z, b.p) &&
  !(b.holes || []).some((h) => insidePolygon(x, z, h));
export class StreetWorld {
  constructor(
    solids = [
      ...collisionSolids,
      ...shopObstacles(),
      ...detailPostObstacles().map((p, i) => ({
        id: 'detail-post:' + i,
        h: p.h,
        minY: p.minY,
        p: [
          [p.x - p.w / 2, p.z - p.d / 2],
          [p.x + p.w / 2, p.z - p.d / 2],
          [p.x + p.w / 2, p.z + p.d / 2],
          [p.x - p.w / 2, p.z + p.d / 2]
        ]
      }))
    ],
    legacyBounds = true
  ) {
    this.cells = new Map();
    this.legacyBounds = legacyBounds;
    this.solids = solids.map((b) => ({
      ...b,
      minY: b.minY ?? b.minHeight ?? 0,
      minX: Math.min(...b.p.map((p) => p[0])),
      maxX: Math.max(...b.p.map((p) => p[0])),
      minZ: Math.min(...b.p.map((p) => p[1])),
      maxZ: Math.max(...b.p.map((p) => p[1]))
    }));
    for (const b of this.solids)
      for (
        let x = Math.floor((b.minX - 1) / 40);
        x <= Math.floor((b.maxX + 1) / 40);
        x++
      )
        for (
          let z = Math.floor((b.minZ - 1) / 40);
          z <= Math.floor((b.maxZ + 1) / 40);
          z++
        ) {
          const key = x + ',' + z;
          if (!this.cells.has(key)) this.cells.set(key, []);
          this.cells.get(key).push(b);
        }
  }
  nearby(x, z) {
    return this.cells.get(Math.floor(x / 40) + ',' + Math.floor(z / 40)) || [];
  }
  surface(x, z, below = Infinity) {
    let y = 0.08;
    for (const b of this.nearby(x, z)) {
      if (b.h > below) continue;
      let support = solidAt(b, x, z);
      if (!support)
        for (const ring of [b.p, ...(b.holes || [])])
          for (let i = 0; i < ring.length; i++) {
            const q = nearest(x, z, ring[i], ring[(i + 1) % ring.length]);
            if (Math.hypot(x - q[0], z - q[1]) <= 0.34) support = true;
          }
      if (support) y = Math.max(y, b.h);
    }
    return y;
  }
  clearance(p, height, radius = 0.34) {
    for (const b of this.nearby(p.x, p.z)) {
      if (p.y + height <= b.minY + 0.001 || p.y >= b.h - 0.001) continue;
      if (solidAt(b, p.x, p.z)) return false;
      for (const ring of [b.p, ...(b.holes || [])])
        for (let i = 0; i < ring.length; i++) {
          const q = nearest(p.x, p.z, ring[i], ring[(i + 1) % ring.length]);
          if (Math.hypot(p.x - q[0], p.z - q[1]) < radius) return false;
        }
    }
    return true;
  }
  move(p, dx, dz, height, step = 0.28) {
    // Axis slides, with a swept capsule approximated by substeps <= half its radius.
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.14));
    let hit = false;
    for (let i = 0; i < n; i++)
      for (const [x, z] of [
        [dx / n, 0],
        [0, dz / n]
      ]) {
        const q = { x: p.x + x, z: p.z + z, y: p.y };
        if (!this.clearance(q, height)) {
          const top = this.surface(q.x, q.z, p.y + step);
          if (
            top > p.y &&
            top - p.y <= step &&
            this.clearance({ ...q, y: top }, height)
          )
            q.y = top;
          else {
            hit = true;
            continue;
          }
        }
        p.x = q.x;
        p.z = q.z;
        p.y = q.y;
      }
    if (this.legacyBounds) {
      // Preserve river-bank and city-boundary handling. Ignore the legacy horizontal
      // building correction only where the 3D capsule has valid vertical clearance.
      const q = { x: p.x, z: p.z };
      if (
        collide(q, 0.34) &&
        !this.nearby(p.x, p.z).some((b) => solidAt(b, p.x, p.z))
      ) {
        p.x = q.x;
        p.z = q.z;
        hit = true;
      }
      p.x = clamp(p.x, WORLD.bounds[0] + 4, WORLD.bounds[2] - 4);
      p.z = clamp(p.z, WORLD.bounds[1] + 4, WORLD.bounds[3] - 4);
    }
    return hit;
  }
  cast(a, d, max = 100, cars = [], ignoreCar = '') {
    let best = max,
      objectId = '',
      kind = 'air';
    const end = pointAlong(a, d, max),
      seen = new Set();
    // Grid traversal is bounded by the weapon range, not the number of city meshes.
    const crossed = [];
    let cx = Math.floor(a.x / 40),
      cz = Math.floor(a.z / 40),
      at = 0;
    const sx = Math.sign(d.x),
      sz = Math.sign(d.z),
      tx = sx ? Math.abs(40 / d.x) : Infinity,
      tz = sz ? Math.abs(40 / d.z) : Infinity;
    let nx = sx ? ((cx + (sx > 0 ? 1 : 0)) * 40 - a.x) / d.x : Infinity,
      nz = sz ? ((cz + (sz > 0 ? 1 : 0)) * 40 - a.z) / d.z : Infinity;
    for (let limit = 0; at <= max && limit < 512; limit++) {
      crossed.push(this.cells.get(cx + ',' + cz) || []);
      if (nx < nz) {
        at = nx;
        nx += tx;
        cx += sx;
      } else {
        at = nz;
        nz += tz;
        cz += sz;
      }
      if (!Number.isFinite(at)) break;
    }
    for (const cell of crossed)
      for (const b of cell) {
        if (seen.has(b)) continue;
        seen.add(b);
        const t = rayBox(
          a,
          d,
          {
            min: { x: b.minX, y: b.minY, z: b.minZ },
            max: { x: b.maxX, y: b.h, z: b.maxZ }
          },
          best
        );
        if (t === null) continue;
        const candidates = [];
        if (solidAt(b, a.x, a.z) && a.y >= b.minY && a.y <= b.h)
          candidates.push(0);
        if (Math.abs(d.y) > 1e-8)
          for (const y of [b.minY, b.h]) {
            const u = (y - a.y) / d.y;
            if (u >= 0 && u <= best && solidAt(b, a.x + d.x * u, a.z + d.z * u))
              candidates.push(u);
          }
        for (const ring of [b.p, ...(b.holes || [])])
          for (let i = 0; i < ring.length; i++) {
            const v = ring[i],
              w = ring[(i + 1) % ring.length],
              sx = w[0] - v[0],
              sz = w[1] - v[1],
              cross = d.x * sz - d.z * sx;
            if (Math.abs(cross) < 1e-9) continue;
            const u = ((v[0] - a.x) * sz - (v[1] - a.z) * sx) / cross,
              q = ((v[0] - a.x) * d.z - (v[1] - a.z) * d.x) / cross,
              y = a.y + d.y * u;
            if (
              u >= 0 &&
              u <= best &&
              q >= 0 &&
              q <= 1 &&
              y >= b.minY &&
              y <= b.h
            )
              candidates.push(u);
          }
        if (candidates.length) {
          best = Math.min(best, ...candidates);
          objectId = String(b.id);
          kind = 'wall';
        }
      }
    for (const car of cars) {
      if (car.id === ignoreCar) continue;
      const size=vehicleSize(car);
      const c = Math.cos(car.heading),
        s = Math.sin(car.heading),
        x = a.x - car.x,
        z = a.z - car.z;
      const t = rayBox(
        { x: x * c - z * s, y: a.y, z: x * s + z * c },
        { x: d.x * c - d.z * s, y: d.y, z: d.x * s + d.z * c },
        {
          min: { x: -size.width/2, y: 0, z: -size.length/2 },
          max: { x: size.width/2, y: car.model==='tirana-bus'?3.5:1.5, z: size.length/2 }
        },
        best
      );
      if (t !== null && t < best) {
        best = t;
        objectId = car.id;
        kind = 'car';
      }
    }
    if (d.y < -0.0001) {
      const t = (0.08 - a.y) / d.y;
      if (t >= 0 && t < best) {
        best = t;
        objectId = 'ground';
        kind = 'ground';
      }
    }
    return { distance: best, point: pointAlong(a, d, best), objectId, kind };
  }
  clear(a, b, cars = [], ignore = '') {
    const v = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z },
      l = Math.hypot(v.x, v.y, v.z);
    if (l < 0.001) return true;
    return (
      this.cast(a, { x: v.x / l, y: v.y / l, z: v.z / l }, l, cars, ignore)
        .distance >=
      l - 0.03
    );
  }
  vault(p, yaw, height) {
    const d = direction3(yaw, 0),
      hit = this.cast({ x: p.x, y: p.y + 0.5, z: p.z }, d, 1.15);
    if (hit.kind !== 'wall') return null;
    const landing = pointAlong(p, d, 1.85),
      top = this.surface(landing.x, landing.z, p.y + 0.85);
    landing.y = top;
    if (Math.abs(top - p.y) > 0.85 || !this.clearance(landing, height))
      return null;
    // The whole raised capsule must clear the obstacle, not only the landing.
    for (let i = 1; i < 8; i++) {
      const q = pointAlong(p, d, (1.85 * i) / 8);
      q.y = p.y + 0.95;
      if (!this.clearance(q, height)) return null;
    }
    return landing;
  }
}
