import { TIRANA_ROUTES } from './tirana-routes.mjs';
import { resolveWallContact, resolveKartContact } from './collisions.mjs';
export { damageRacer } from './collisions.mjs';
export const STEP = 1 / 60,
  LAPS = 1;
export const COLORS = [
  '#baff29',
  '#44caff',
  '#ff679d',
  '#a98aff',
  '#ffb64d',
  '#f3f6f2'
];
export const RACE_LIMIT = 900;
export const KARTS = [
  { id: 'apex', name: 'Apex 02', detail: 'Exposed chassis · mechanical kart' },
  { id: 'oobi', name: 'Eagle', detail: 'Compact body · classic sprint' },
  { id: 'oodi', name: 'Illyrian', detail: 'Front fairing · road racer' },
  { id: 'ooli', name: 'Besa', detail: 'Wide sidepods · touring kart' },
  { id: 'oopi', name: 'Dajti', detail: 'Rear aero · club racer' },
  { id: 'oozi', name: 'Lana', detail: 'Low nose · street special' }
];
export const normalizeKart = (id) =>
  KARTS.some((k) => k.id === id) ? id : 'apex';
export const TRACK_ALIASES = {
  harbor: 'skanderbeg',
  neon: 'blloku',
  canyon: 'lana',
  alpine: 'pyramid',
  coast: 'stadium'
};
export const normalizeTrack = (id) => TRACK_ALIASES[id] || id;
export const TRACKS = TIRANA_ROUTES.map((config) => ({
  ...config,
  width: 6.2,
  sky: '#adc8d2',
  ground: '#a6a58e'
}));
export const CUPS = TRACKS.map((t, i) => ({
  name: `${String(i + 1).padStart(2, '0')} · ${t.district.split(' · ')[0]}`,
  track: t.id,
  difficulty: i < 3 ? 'rookie' : i < 7 ? 'street' : 'pro',
  target: i < 7 ? 3 : 1,
  reward: 150 + i * 50
}));
export function randomTrack(random = Math.random) {
  return TRACKS[
    Math.min(
      TRACKS.length - 1,
      Math.max(0, Math.floor(random() * TRACKS.length))
    )
  ].id;
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const cache = new Map();
export function makeTrack(id = 'skanderbeg') {
  id = normalizeTrack(id);
  const config = TRACKS.find((t) => t.id === id) || TRACKS[0];
  if (cache.has(config.id)) return cache.get(config.id);
  // Keep real street geometry. Resample before rounding so long straight roads
  // are never turned into invented oval tracks or curves through city blocks.
  // Open polylines retain both endpoints. Never close an 8km route across blocks.
  let raw = config.points.flatMap((p, i) => {
    if (i === config.points.length - 1) return [p];
    const q = config.points[i + 1],
      n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 3));
    return Array.from({ length: n }, (_, j) => [
      p[0] + ((q[0] - p[0]) * j) / n,
      p[1] + ((q[1] - p[1]) * j) / n
    ]);
  });
  for (let pass = 0; pass < 2; pass++) {
    const rounded = [raw[0]];
    for (let i = 0; i < raw.length - 1; i++) {
      const p = raw[i],
        q = raw[i + 1];
      rounded.push(
        [p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25],
        [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]
      );
    }
    rounded.push(raw.at(-1));
    raw = rounded;
  }
  const distances = [0];
  for (let i = 1; i < raw.length; i++)
    distances.push(
      distances[i - 1] +
        Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1])
    );
  const total = distances.at(-1),
    count = Math.max(360, Math.ceil(total / 3) + 1);
  let seg = 0;
  const points = Array.from({ length: count }, (_, i) => {
    const distance = (i * total) / (count - 1);
    while (seg < raw.length - 2 && distances[seg + 1] < distance) seg++;
    const p = raw[seg],
      q = raw[seg + 1],
      f =
        (distance - distances[seg]) /
        (distances[seg + 1] - distances[seg] || 1);
    return {
      x: p[0] + (q[0] - p[0]) * f,
      z: p[1] + (q[1] - p[1]) * f,
      distance,
      yaw: 0
    };
  });
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)],
      q = points[Math.min(count - 1, i + 1)];
    p.yaw = Math.atan2(q.x - a.x, q.z - a.z);
  });
  const length = total;
  const xs = points.map((p) => p.x),
    zs = points.map((p) => p.z);
  const bounds = [
    Math.min(...xs),
    Math.min(...zs),
    Math.max(...xs),
    Math.max(...zs)
  ];
  const result = {
    ...config,
    points,
    length,
    bounds,
    center: { x: (bounds[0] + bounds[2]) / 2, z: (bounds[1] + bounds[3]) / 2 },
    x: (bounds[2] - bounds[0]) / 2,
    z: (bounds[3] - bounds[1]) / 2,
    bend: 0
  };
  cache.set(config.id, result);
  return result;
}
const segmentGrids = new WeakMap();
function nearbySegments(track, x, z) {
  let grid = segmentGrids.get(track);
  if (!grid) {
    grid = new Map();
    for (let i = 0; i < track.points.length - 1; i++) {
      const a = track.points[i],
        b = track.points[i + 1];
      for (
        let gx = Math.floor(Math.min(a.x, b.x) / 24);
        gx <= Math.floor(Math.max(a.x, b.x) / 24);
        gx++
      )
        for (
          let gz = Math.floor(Math.min(a.z, b.z) / 24);
          gz <= Math.floor(Math.max(a.z, b.z) / 24);
          gz++
        ) {
          const key = `${gx}:${gz}`;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(i);
        }
    }
    segmentGrids.set(track, grid);
  }
  const candidates = new Set(),
    gx = Math.floor(x / 24),
    gz = Math.floor(z / 24);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++)
      for (const i of grid.get(`${gx + dx}:${gz + dz}`) || [])
        candidates.add(i);
  return candidates.size
    ? candidates
    : Array.from({ length: track.points.length - 1 }, (_, i) => i);
}
export function nearestPoint(track, x, z) {
  let best = { index: 0, distance: Infinity, lane: 0, x: 0, z: 0, yaw: 0 },
    distanceSq = Infinity;
  for (const i of nearbySegments(track, x, z)) {
    const p = track.points[i],
      q = track.points[i + 1],
      dx = q.x - p.x,
      dz = q.z - p.z;
    const u = clamp(
      ((x - p.x) * dx + (z - p.z) * dz) / (dx * dx + dz * dz || 1),
      0,
      1
    );
    const px = p.x + dx * u,
      pz = p.z + dz * u,
      d = (x - px) ** 2 + (z - pz) ** 2;
    if (d < distanceSq) {
      distanceSq = d;
      best = {
        index: i,
        distance: Math.sqrt(d),
        lane: (x - px) * -Math.cos(p.yaw) + (z - pz) * Math.sin(p.yaw),
        x: px,
        z: pz,
        yaw: p.yaw,
        along: p.distance + u * Math.hypot(dx, dz)
      };
    }
  }
  return best;
}
export function createRacer(track, id, name, slot = 0, ai = false) {
  const index = Math.max(
      1,
      Math.round(
        (18 - Math.floor(slot / 2) * 6) /
          (track.length / (track.points.length - 1))
      )
    ),
    p = track.points[index],
    lane = slot % 2 ? 1.3 : -1.3;
  return {
    id,
    name: String(name).slice(0, 18),
    slot,
    ai,
    color: COLORS[slot % 6],
    x: p.x - Math.cos(p.yaw) * lane,
    z: p.z + Math.sin(p.yaw) * lane,
    yaw: p.yaw,
    velocityYaw: p.yaw,
    speed: 0,
    steering: 0,
    yawRate: 0,
    acceleration: 0,
    boost: 100,
    driftCharge: 0,
    turbo: 0,
    drifting: false,
    lap: 1,
    nextGate: 1,
    gates: 0,
    index,
    progress: 0,
    routeDistance: p.distance,
    finished: false,
    finishTime: 0,
    collision: 0,
    health: 100,
    kartId: KARTS[slot % KARTS.length].id,
    retired: false,
    wallContact: false,
    impactId: 0,
    impact: 0,
    impactNx: 0,
    impactNz: 1,
    impactCooldown: 0,
    damageFront: 0,
    damageRear: 0,
    damageSide: 0,
    hitFlash: 0,
    input: { steer: 0, brake: false, drift: false, boost: false },
    lastInput: 0,
    disconnected: false
  };
}
export function aiInput(r, track, time, difficulty = 'street') {
  const n = nearestPoint(track, r.x, r.z),
    spacing = track.length / (track.points.length - 1);
  const at = (i) => track.points[Math.min(track.points.length - 1, i)];
  const look = clamp(5 + r.speed * 0.34, 6, 17);
  const p = at(n.index + Math.max(2, Math.round(look / spacing)));
  const lane = Math.sin(time * 0.2 + r.slot * 2) * 0.65;
  const turn = wrapAngle(
    Math.atan2(
      p.x - Math.cos(p.yaw) * lane - r.x,
      p.z + Math.sin(p.yaw) * lane - r.z
    ) - r.yaw
  );
  let safeSpeed = 32;
  // Brake before the corner, from its curvature and the remaining stop distance.
  for (let d = 1; d <= Math.ceil(45 / spacing); d++) {
    const a = at(n.index + d),
      b = at(n.index + d + 1);
    const curve = Math.abs(wrapAngle(b.yaw - a.yaw)) / spacing;
    if (curve > 0.005)
      safeSpeed = Math.min(
        safeSpeed,
        Math.sqrt(4.2 / curve + 2 * 16 * Math.max(0, d * spacing - 8))
      );
  }
  safeSpeed = Math.max(7, safeSpeed);
  return {
    steer: clamp(-turn * 3.6, -1, 1),
    brake: r.speed > safeSpeed || (Math.abs(turn) > 0.55 && r.speed > 8),
    drift: false,
    boost:
      Math.abs(turn) < 0.04 &&
      safeSpeed > 30 &&
      r.boost > 65 &&
      difficulty !== 'rookie'
  };
}
// Positive input steers visually RIGHT in a chase camera looking along +Z.
// Both clients and server use this fixed-step simulation; scores are never accepted.
export function stepRacer(r, raw, track, dt, time, difficulty = 'street') {
  if (r.finished || r.retired || r.disconnected) return;
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, STEP * 3);
  const input = raw || {},
    steer = Number.isFinite(input.steer) ? clamp(input.steer, -1, 1) : 0;
  const previousSpeed = r.speed;
  r.health = Number.isFinite(r.health) ? r.health : 100;
  r.hitFlash = Math.max(0, (r.hitFlash || 0) - dt);
  r.impactCooldown = Math.max(0, (r.impactCooldown || 0) - dt);
  // A finite steering rack response makes touch buttons progressive. Physics
  // and the visible wheels share this value on both the client and server.
  r.steering =
    (r.steering || 0) +
    (steer - (r.steering || 0)) * (1 - Math.exp(-dt * (steer ? 8 : 12)));
  const drift =
      input.drift === true && r.speed > 10 && Math.abs(r.steering) > 0.08,
    boost = input.boost === true && r.boost > 0 && !input.brake;
  const factor = r.ai
      ? ({ rookie: 0.76, street: 0.88, pro: 0.98 }[difficulty] || 0.88) +
        r.slot * 0.006
      : 1,
    damageFactor = 0.82 + r.health * 0.0018,
    max = (boost || r.turbo > 0 ? 43 : 31) * factor * damageFactor;
  r.speed = clamp(
    r.speed +
      (input.brake
        ? -28
        : (boost || r.turbo > 0 ? 22 : 13.8) * factor * damageFactor -
          0.6 -
          0.16 * r.speed -
          0.008 * r.speed * r.speed) *
        dt,
    0,
    max
  );
  if (drift) {
    r.speed = Math.max(0, r.speed - 0.75 * dt);
    r.driftCharge = Math.min(1.5, r.driftCharge + dt);
  } else if (r.drifting) {
    if (r.driftCharge > 0.5) r.turbo = Math.min(1.8, r.driftCharge);
    r.driftCharge = 0;
  }
  r.drifting = drift;
  r.turbo = Math.max(0, r.turbo - dt);
  r.boost = clamp(r.boost + (boost ? -34 : drift ? 17 : 5) * dt, 0, 100);
  const turn =
    (-r.steering * (drift ? 1.48 : 1.15) * clamp(r.speed / 10, 0, 1)) /
    (1 + Math.max(0, r.speed - 22) * 0.022);
  r.yawRate =
    (r.yawRate || 0) +
    (turn - (r.yawRate || 0)) * (1 - Math.exp(-dt * (drift ? 7 : 12)));
  r.yaw += r.yawRate * dt;
  // Tire scrub sheds speed in sustained corners; braking restores grip sooner.
  r.speed = Math.max(
    0,
    r.speed - Math.abs(r.yawRate) * r.speed * (drift ? 0.022 : 0.014) * dt
  );
  r.velocityYaw +=
    wrapAngle(r.yaw - r.velocityYaw) *
    (1 - Math.exp(-dt * (drift ? 3.1 : input.brake ? 14 : 11)));
  r.x += Math.sin(r.velocityYaw) * r.speed * dt;
  r.z += Math.cos(r.velocityYaw) * r.speed * dt;
  const near = nearestPoint(track, r.x, r.z);
  r.collision = Math.max(0, r.collision - dt);
  resolveWallContact(r, near, track.width, dt);
  if (r.retired) return;
  r.acceleration = clamp((r.speed - previousSpeed) / dt, -35, 25);
  // Every 20m gate must be crossed in order. Local nearest points at parallel
  // roads cannot award progress: accepted arc movement is bounded by actual travel.
  const along = near.along,
    prior = r.routeDistance ?? 0;
  const advance = along - prior;
  const maxAdvance = Math.max(4, r.speed * dt * 2 + 1);
  if (
    advance >= 0 &&
    advance <= maxAdvance &&
    near.distance <= track.width / 2
  ) {
    const gate = Math.floor(along / 20);
    if (gate <= r.nextGate) {
      if (gate === r.nextGate) {
        r.gates++;
        r.nextGate++;
      }
      r.routeDistance = along;
      r.progress = along / track.length;
      if (
        track.length - along < 2.2 &&
        r.nextGate >= Math.floor(track.length / 20)
      ) {
        r.finished = true;
        r.finishTime = time;
        r.speed = 0;
        r.progress = 1;
        r.lap = 2;
      }
    }
  } else if (advance < 0 && advance > -maxAdvance) r.routeDistance = along;
  r.index = near.index;
}
export function stepRace(racers, track, dt, time, difficulty = 'street') {
  for (const r of racers)
    stepRacer(
      r,
      r.ai ? aiInput(r, track, time, difficulty) : r.input,
      track,
      dt,
      time,
      difficulty
    );
  // A second positional pass prevents multi-kart contacts from leaving bodies
  // interpenetrating or pushed through a track barrier.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < racers.length; i++)
      for (let j = i + 1; j < racers.length; j++)
        resolveKartContact(racers[i], racers[j]);
    for (const r of racers)
      if (!r.retired && !r.finished && !r.disconnected) {
        const near = nearestPoint(track, r.x, r.z);
        if (near.distance > track.width / 2 - 1.05)
          resolveWallContact(r, near, track.width, dt, false);
      }
  }
}
export const standings = (racers) =>
  [...racers].sort(
    (a, b) =>
      Number(b.finished) - Number(a.finished) ||
      (a.finished && b.finished
        ? a.finishTime - b.finishTime
        : Number(a.disconnected || a.retired) -
            Number(b.disconnected || b.retired) || b.progress - a.progress)
  );
