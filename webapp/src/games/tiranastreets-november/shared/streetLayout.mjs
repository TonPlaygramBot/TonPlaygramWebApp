import { WORLD } from './world.mjs';

// Shared, deterministic city fixtures. The server and the renderer use the same
// doorway, stop lines and signal clock; none of these depend on camera axes.
export const SIDEWALK_WIDTH = 2.4;
export const SIDEWALK_HEIGHT = 0.23;
export const CITIZEN_COUNT = 72;
export const segmentDistance = (x, z, a, b) => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))
  );
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
};
const footprint = WORLD.buildings.map((b) => ({
  minX: Math.min(...b.p.map((p) => p[0])),
  maxX: Math.max(...b.p.map((p) => p[0])),
  minZ: Math.min(...b.p.map((p) => p[1])),
  maxZ: Math.max(...b.p.map((p) => p[1]))
}));
function shopSite() {
  for (let radius = 22; radius <= 100; radius += 9) {
    for (let i = 0; i < 24; i++) {
      const x = -59.39 + Math.cos((i * Math.PI) / 12) * radius;
      const z = 126.25 + Math.sin((i * Math.PI) / 12) * radius;
      if (
        footprint.some(
          (b) =>
            x + 6 > b.minX && x - 6 < b.maxX && z + 6 > b.minZ && z - 5 < b.maxZ
        )
      )
        continue;
      if (
        WORLD.roads.some(
          (r) => !r.walk && segmentDistance(x, z, r.a, r.b) < r.w / 2 + 7.8
        )
      )
        continue;
      return { x, z, name: 'Arben · Arsenal' };
    }
  }
  return { x: -42, z: 82, name: 'Arben · Arsenal' };
}
export const SHOP = shopSite();
// Boxes are local to the shop. The 2.5 m doorway opens toward local +Z.
export const SHOP_SOLIDS = [
  [-5, -4.2, -4.72, 4.2],
  [4.72, -4.2, 5, 4.2],
  [-5, -4.2, 5, -3.92],
  [-5, 3.92, -1.25, 4.2],
  [1.25, 3.92, 5, 4.2],
  [-3.8, -2.65, 3.1, -1.8],
  [-4.55, -0.9, -3.8, 2.6],
  [3.8, -0.9, 4.55, 2.6]
];
export function insideShop(p, shop = SHOP) {
  return (
    Math.abs(p.x - shop.x) < 4.7 && p.z - shop.z > -3.8 && p.z - shop.z < 3.9
  );
}
export function canReachCounter(p, shop = SHOP) {
  return (
    !p.carId &&
    Math.abs(p.x - shop.x) < 3.5 &&
    p.z - shop.z > -1.7 &&
    p.z - shop.z < 1.4
  );
}
export function collideShop(p, radius) {
  if (Math.abs(p.x - SHOP.x) > 7 || Math.abs(p.z - SHOP.z) > 7) return false;
  let hit = false;
  for (const [a, b, c, d] of SHOP_SOLIDS) {
    const x = p.x - SHOP.x,
      z = p.z - SHOP.z;
    const qx = Math.max(a, Math.min(c, x)),
      qz = Math.max(b, Math.min(d, z));
    const dx = x - qx,
      dz = z - qz,
      distance = Math.hypot(dx, dz);
    if (distance >= radius) continue;
    hit = true;
    if (distance > 0.0001) {
      p.x = SHOP.x + qx + (dx / distance) * (radius + 0.005);
      p.z = SHOP.z + qz + (dz / distance) * (radius + 0.005);
    } else {
      const edges = [
        [x - a, a - radius, z],
        [c - x, c + radius, z],
        [z - b, x, b - radius],
        [d - z, x, d + radius]
      ].sort((u, v) => u[0] - v[0]);
      p.x = SHOP.x + edges[0][1];
      p.z = SHOP.z + edges[0][2];
    }
  }
  return hit;
}

const roadCells = new Map();
for (const r of WORLD.roads) {
  if (r.walk) continue;
  const pad = r.w / 2 + SIDEWALK_WIDTH + 1;
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
      if (!roadCells.has(key)) roadCells.set(key, []);
      roadCells.get(key).push(r);
    }
}
export const roadsNear = (x, z) =>
  roadCells.get(`${Math.floor(x / 32)},${Math.floor(z / 32)}`) || [];
export function onCarriageway(x, z, margin = 0) {
  return roadsNear(x, z).some(
    (r) => segmentDistance(x, z, r.a, r.b) < r.w / 2 + margin
  );
}
export function pavementHeight(x, z) {
  if (insideShop({ x, z })) return SIDEWALK_HEIGHT;
  const roads = roadsNear(x, z);
  if (roads.some((r) => segmentDistance(x, z, r.a, r.b) < r.w / 2 + 0.08))
    return 0.1;
  if (
    !roads.some(
      (r) => segmentDistance(x, z, r.a, r.b) < r.w / 2 + SIDEWALK_WIDTH
    )
  )
    return 0.08;
  let height = SIDEWALK_HEIGHT;
  for (const s of signalsNear(x, z)) {
    const ramp = Math.max(
      0,
      Math.min(1, (Math.hypot(x - s.x, z - s.z) - s.width / 2 - 2) / 0.9)
    );
    height = Math.min(height, 0.115 + 0.115 * ramp);
  }
  return height;
}

const junctions = new Map();
for (const road of WORLD.roads) {
  if (road.walk || road.w < 5.8 || road.bridge) continue;
  for (const [a, b] of [
    [road.a, road.b],
    [road.b, road.a]
  ]) {
    const key = `${Math.round(a[0])},${Math.round(a[1])}`;
    if (!junctions.has(key)) junctions.set(key, { x: a[0], z: a[1], arms: [] });
    const j = junctions.get(key),
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 13) continue;
    const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    if (
      !j.arms.some(
        (v) =>
          Math.abs(Math.atan2(Math.sin(v.yaw - yaw), Math.cos(v.yaw - yaw))) <
          0.35
      )
    )
      j.arms.push({ road, yaw, len });
  }
}
export const SIGNALS = [];
for (const j of [...junctions.values()]
  .filter((j) => j.arms.length >= 3)
  .sort(
    (a, b) => Math.hypot(a.x + 59, a.z - 126) - Math.hypot(b.x + 59, b.z - 126)
  )) {
  if (SIGNALS.some((s) => Math.hypot(s.x - j.x, s.z - j.z) < 35)) continue;
  const junction = SIGNALS.length;
  for (const arm of j.arms) {
    const ux = Math.sin(arm.yaw),
      uz = Math.cos(arm.yaw),
      setback = Math.min(11, arm.len * 0.38);
    const poleX = j.x + ux * setback + uz * (arm.road.w / 2 + 0.48);
    const poleZ = j.z + uz * setback - ux * (arm.road.w / 2 + 0.48);
    // Only simulate stop lines whose physical signal fits on the sidewalk.
    // This prevents vehicles obeying a light that the renderer cannot place.
    if (
      onCarriageway(poleX, poleZ, 0.35) ||
      Math.abs(poleX - SHOP.x) + Math.abs(poleZ - SHOP.z) <= 13 ||
      footprint.some(
        (b) =>
          poleX >= b.minX &&
          poleX <= b.maxX &&
          poleZ >= b.minZ &&
          poleZ <= b.maxZ
      )
    )
      continue;
    SIGNALS.push({
      id: `signal-${junction}-${SIGNALS.length}`,
      junction,
      x: j.x + ux * setback,
      z: j.z + uz * setback,
      yaw: arm.yaw,
      width: arm.road.w,
      name: arm.road.name,
      axis: Math.abs(ux) > Math.abs(uz) ? 0 : 1
    });
  }
  if (SIGNALS.length >= 64) break;
}
const signalCells = new Map();
for (const signal of SIGNALS) {
  const pad = signal.width / 2 + 12;
  for (
    let x = Math.floor((signal.x - pad) / 32);
    x <= Math.floor((signal.x + pad) / 32);
    x++
  )
    for (
      let z = Math.floor((signal.z - pad) / 32);
      z <= Math.floor((signal.z + pad) / 32);
      z++
    ) {
      const key = `${x},${z}`;
      if (!signalCells.has(key)) signalCells.set(key, []);
      signalCells.get(key).push(signal);
    }
}
export const signalsNear = (x, z) =>
  signalCells.get(`${Math.floor(x / 32)},${Math.floor(z / 32)}`) || [];
export function signalPhase(signal, seconds) {
  const t = (((seconds + signal.junction * 1.7) % 32) + 32) % 32;
  if (t >= 24) return 'red'; // all traffic stops for the pedestrian interval
  const local = signal.axis === 0 ? t : t - 12;
  return local >= 0 && local < 9
    ? 'green'
    : local >= 9 && local < 11
      ? 'amber'
      : 'red';
}
export function pedestrianGreen(signal, seconds) {
  return (((seconds + signal.junction * 1.7) % 32) + 32) % 32 >= 25;
}
export function stopForSignal(vehicle, seconds) {
  const fx = -Math.sin(vehicle.heading),
    fz = -Math.cos(vehicle.heading);
  return signalsNear(vehicle.x, vehicle.z).some((s) => {
    if (signalPhase(s, seconds) === 'green') return false;
    const ux = Math.sin(s.yaw),
      uz = Math.cos(s.yaw);
    if (fx * ux + fz * uz > -0.72) return false;
    const dx = vehicle.x - s.x,
      dz = vehicle.z - s.z;
    const ahead = dx * ux + dz * uz,
      lateral = Math.abs(dx * uz - dz * ux);
    return ahead > 0 && ahead < 7 && lateral < s.width / 2 + 0.3;
  });
}

// Fraction to the first physical shop wall or display intersected by a ray.
export function shopRayDistance(a, b) {
  let result = 1;
  if (
    Math.max(a.x, b.x) < SHOP.x - 5 ||
    Math.min(a.x, b.x) > SHOP.x + 5 ||
    Math.max(a.z, b.z) < SHOP.z - 4.2 ||
    Math.min(a.z, b.z) > SHOP.z + 4.2
  )
    return result;
  for (const [x1, z1, x2, z2] of SHOP_SOLIDS) {
    let near = 0,
      far = 1;
    for (const [start, delta, min, max] of [
      [a.x, b.x - a.x, SHOP.x + x1, SHOP.x + x2],
      [a.z, b.z - a.z, SHOP.z + z1, SHOP.z + z2]
    ]) {
      if (Math.abs(delta) < 1e-8) {
        if (start < min || start > max) {
          near = 2;
          break;
        }
        continue;
      }
      const t1 = (min - start) / delta,
        t2 = (max - start) / delta;
      near = Math.max(near, Math.min(t1, t2));
      far = Math.min(far, Math.max(t1, t2));
    }
    if (near <= far && far > 0 && near > 0) result = Math.min(result, near);
  }
  return result;
}
