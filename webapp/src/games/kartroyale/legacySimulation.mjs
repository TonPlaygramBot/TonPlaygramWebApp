import { stepDrift, stepBoostPads, stepSlipstream } from './arcadeRules.mjs';
import {KARTS} from './vehicleCatalog.mjs';
export {KARTS};
import { TIRANA_ROUTES } from './tirana-routes.mjs';
import { resolveWallContact, resolveKartContact, damageRacer } from './collisions.mjs';
import { resampleCircuit } from './grandRouteCore.mjs';
import { pointAhead, cornerSpeedLimit, sampleCircuitDistance } from './circuitMetrics.mjs';
export { damageRacer };
export const STEP = 1 / 60,
  LAPS = 3;
export const COLORS = [
  '#baff29',
  '#44caff',
  '#ff679d',
  '#a98aff',
  '#ffb64d',
  '#f3f6f2'
];
export const RACE_LIMIT = 1500;
export const normalizeKart = (id) =>
  KARTS.some((k) => k.id === id) ? id : 'apex';
export function equipKart(r, id) {
  const kartId=normalizeKart(id), kart=KARTS.find(k=>k.id===kartId);
  r.bodyLength=2.7;
  r.bodyWidth=1.72;
  r.kartId=kartId; r.shieldMax=kart.shield; r.shield=kart.shield;
  r.ammunition=kart.ammunition; r.fireCooldown=0;
  return r;
}
export const TRACK_ALIASES = {
  harbor: 'skanderbeg',
  neon: 'blloku',
  canyon: 'lana',
  alpine: 'pyramid',
  coast: 'stadium'
};
export const normalizeTrack = (id) => TRACK_ALIASES[id] || id;
export const TRACKS = [
  {
    id: 'skanderbeg',
    name: 'Skënderbej Circuit',
    district: 'TIRANA · CITY CENTRE',
    accent: '#ed3f45'
  },
  {
    id: 'blloku',
    name: 'Blloku Sprint',
    district: 'TIRANA · BLLOKU',
    accent: '#ffd26f'
  },
  {
    id: 'lana',
    name: 'Lana Riverside',
    district: 'TIRANA · LANA',
    accent: '#5de1d4'
  },
  {
    id: 'pyramid',
    name: 'Pyramid Loop',
    district: 'TIRANA · PIRAMIDA',
    accent: '#bece54'
  },
  {
    id: 'stadium',
    name: 'Nënë Tereza Run',
    district: 'TIRANA · SHESHI ITALIA',
    accent: '#7dcaff'
  }
].map((config) => ({
  ...config,
  // A full five-lane event ribbon gives the larger vehicles believable room
  // while preserving every mapped Tirana street centreline coordinate.
  width: 20,
  sky: '#adc8d2',
  ground: '#a6a58e',
  ...TIRANA_ROUTES.find((r) => r.id === config.id)
}));
export const CUPS = [
  {
    name: 'Rookie Cup',
    track: 'skanderbeg',
    difficulty: 'rookie',
    target: 3,
    reward: 150
  },
  {
    name: 'Street Cup',
    track: 'blloku',
    difficulty: 'street',
    target: 3,
    reward: 250
  },
  {
    name: 'Royale Cup',
    track: 'lana',
    difficulty: 'pro',
    target: 1,
    reward: 500
  }
];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const cache = new Map();
export function makeTrack(id = 'skanderbeg') {
  id = normalizeTrack(id);
  const config = TRACKS.find((t) => t.id === id) || TRACKS[0];
  if (cache.has(config.id)) return cache.get(config.id);
  // Retain every mapped corner exactly. The previous two-pass corner cutting
  // visibly rounded Tirana intersections and could move the racing line away
  // from the checked-in road centreline.
  const { points, length } = resampleCircuit(config.points, 360);
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
export function nearestPoint(track, x, z, hint) {
  let best = { index: 0, distance: Infinity, lane: 0, x: 0, z: 0, yaw: 0 },
    distanceSq = Infinity;
  const count=track.points.length;
  const local=Number.isInteger(hint)&&hint>=0&&hint<count;
  const window=Math.min(24,Math.floor((count-1)/2));
  for (let step = 0; step < (local?window*2+1:count); step++) {
    const i=local?(hint-window+step+count)%count:step;
    const p = track.points[i],
      q = track.points[(i + 1) % track.points.length],
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
        width: (p.width ?? track.width) + ((q.width ?? track.width) - (p.width ?? track.width)) * u,
        distance: Math.sqrt(d),
        lane: (x - px) * -Math.cos(p.yaw) + (z - pz) * Math.sin(p.yaw),
        x: px,
        z: pz,
        yaw: p.yaw
      };
    }
  }
  // At bridges and parallel carriageways the route's current segment wins.
  // A genuinely displaced vehicle may still recover onto the nearest road.
  if(local&&best.distance>track.width*1.5)return nearestPoint(track,x,z);
  return best;
}
export function createRacer(track, id, name, slot = 0, ai = false) {
  const p = sampleCircuitDistance(track, -18 - Math.floor(slot / 2) * 9),
    index = p.index,
    lane = (slot % 2 ? 1 : -1) * Math.min(1.65, (track.points[index].width ?? track.width) / 4);
  const kart = KARTS[slot % KARTS.length];
  const racer = {
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
    rollTime: 0, rollAngle: 0, rollDirection: 1, rollCooldown: 0, lift: 0,
    steering: 0,
    yawRate: 0,
    acceleration: 0,
    boost: 100,
    driftCharge: 0,
    recoveryAt: -10, hop: 0, boostEvent: 0, slipstream: 0, draftCooldown: 0, padCooldowns: {},
    turbo: 0,
    drifting: false,
    lap: 0,
    nextGate: 0,
    gates: 0,
    index,
    progress: (index - track.points.length) / track.points.length,
    finished: false,
    finishTime: 0,
    collision: 0,
    health: 100,
    kartId: kart.id,
    shield: kart.shield,
    shieldMax: kart.shield,
    shieldActive: false,
    ammunition: kart.ammunition,
    fireCooldown: 0,
    missileHits: 0,
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
    input: { steer: 0, brake: false, drift: false, boost: false, shield: false, fire: false },
    lastInput: 0,
    disconnected: false
  };
  equipKart(racer,kart.id);
  return racer;
}
export function aiInput(r, track, time, difficulty = 'street') {
  const n = nearestPoint(track, r.x, r.z, r.index);
  const look = clamp(5 + r.speed * 0.34, 6, 17);
  const p = pointAhead(track, n, look);
  const lane = Math.sin(time * 0.2 + r.slot * 2) * 0.65;
  const turn = wrapAngle(
    Math.atan2(
      p.x - Math.cos(p.yaw) * lane - r.x,
      p.z + Math.sin(p.yaw) * lane - r.z
    ) - r.yaw
  );
  const safeSpeed = cornerSpeedLimit(track, n);
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
  if (input.recover === true && time - (r.recoveryAt ?? -10) >= 3) {
    const point = track.points[r.index];
    r.x = point.x; r.z = point.z; r.yaw = r.velocityYaw = point.yaw;
    r.speed = 0; r.yawRate = 0; r.steering = 0; r.drifting = false;
    r.driftCharge = 0; r.turbo = 0; r.recoveryAt = time;
    // Keep index, gates, laps and progress: recovery cannot manufacture distance.
    return;
  }
  const previousSpeed = r.speed;
  r.health = Number.isFinite(r.health) ? r.health : 100;
  r.hitFlash = Math.max(0, (r.hitFlash || 0) - dt);
  r.impactCooldown = Math.max(0, (r.impactCooldown || 0) - dt);
  r.fireCooldown = Math.max(0, (r.fireCooldown || 0) - dt);
  const kart = KARTS.find(k => k.id === r.kartId) || KARTS[0];
  // Keep legacy wire fields inert so stale clients cannot enable combat.
  r.shieldMax = 0; r.shield = 0; r.shieldActive = false; r.ammunition = 0;
  // A finite steering rack response makes touch buttons progressive. Physics
  // and the visible wheels share this value on both the client and server.
  r.steering =
    (r.steering || 0) +
    (steer - (r.steering || 0)) * (1 - Math.exp(-dt * (steer ? 8 : 12)));
  const drift = stepDrift(r, input, dt),
    boost = input.boost === true && r.boost > 1 && !input.brake && !input.reverse && r.speed >= 0;
  const factor = r.ai
      ? ({ rookie: 0.76, street: 0.88, pro: 0.98 }[difficulty] || 0.88) +
        r.slot * 0.006
      : 1,
    damageFactor = 1,
    max = (boost || r.turbo > 0 ? 43 : 31) * kart.speed * factor * damageFactor;
  r.speed = clamp(
    r.speed +
      (input.reverse === true
        ? (r.speed > 0 ? -28 * kart.brake : -7)
        : input.brake
        ? -Math.sign(r.speed) * 28 * kart.brake
        : (boost || r.turbo > 0 ? 22 : (kart.id === 'oopi' ? 17 : 15.5)) * kart.speed * factor * damageFactor -
          0.6 -
          0.16 * r.speed -
          0.008 * r.speed * r.speed) *
        dt,
    input.reverse === true || r.speed < 0 ? -7 : 0,
    max
  );
  if (input.brake && !input.reverse && Math.sign(r.speed) !== Math.sign(previousSpeed)) r.speed = 0;
  // Nitro is earned primarily by cornering; passive recharge prevents dead ends.
  r.boost = clamp(r.boost + (boost ? -32 : drift ? 14 : 3) * dt, 0, 100);
  const turn =
    (-r.steering * kart.handling * (drift ? 1.42 : 1.28) * clamp(r.speed / 10, -1, 1)) /
    (1 + Math.max(0, r.speed - 22) * 0.022);
  r.yawRate =
    (r.yawRate || 0) +
    (turn - (r.yawRate || 0)) * (1 - Math.exp(-dt * (drift ? 7 : 12)));
  r.yaw += r.yawRate * dt;
  // Gentle edge assistance preserves screen-relative steering and never teleports.
  // Only turn toward the route when moving forward into its outside edge.
  const guidance = nearestPoint(track, r.x, r.z, r.index);
  if (!input.reverse && !input.brake && r.speed > 2 && guidance.distance > (guidance.width ?? track.width) * .32) {
    const target = pointAhead(track, guidance, Math.max(6, r.speed * .45));
    const correction = wrapAngle(Math.atan2(target.x-r.x,target.z-r.z)-r.yaw);
    if (Math.abs(correction) < 1.4) r.yaw += correction * dt * 1.8;
  }
  // Tire scrub sheds speed in sustained corners; braking restores grip sooner.
  r.speed *= Math.max(0, 1 - Math.abs(r.yawRate) * (drift ? 0.022 : 0.014) * dt);
  r.velocityYaw +=
    wrapAngle(r.yaw - r.velocityYaw) *
    (1 - Math.exp(-dt * (drift ? 3.1 : input.brake ? 14 : 11)));
  r.x += Math.sin(r.velocityYaw) * r.speed * dt;
  r.z += Math.cos(r.velocityYaw) * r.speed * dt;
  const near = nearestPoint(track, r.x, r.z, r.index);
  r.collision = Math.max(0, r.collision - dt);
  resolveWallContact(r, near, near.width ?? track.width, dt);
  if (r.retired) return;
  r.acceleration = clamp((r.speed - previousSpeed) / dt, -35, 25);
  stepBoostPads(r, track, time);
  // Sequential quarter-track gates reject shortcuts and finish-line oscillation.
  const count = track.points.length;
  const delta = ((near.index - r.index + count * 1.5) % count) - count / 2;
  if (delta > 0 && delta < 24) {
    const crossed = (r.nextGate * (count / 4) - r.index + count) % count;
    if (crossed > 0 && crossed <= delta) {
      r.gates++;
      if (r.nextGate === 0) {
        r.lap++;
        if (r.lap > LAPS) {
          r.finished = true;
          r.finishTime = time;
          r.speed = 0;
        }
      }
      r.nextGate = (r.nextGate + 1) % 4;
    }
  }
  r.index = near.index;
  r.progress = r.finished
    ? LAPS + 1
    : Math.max(-1, r.lap - 1) + near.index / count;
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
  stepSlipstream(racers, dt);
  // A second positional pass prevents multi-kart contacts from leaving bodies
  // interpenetrating or pushed through a track barrier.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < racers.length; i++)
      for (let j = i + 1; j < racers.length; j++)
        resolveKartContact(racers[i], racers[j]);
    for (const r of racers)
      if (!r.retired && !r.finished && !r.disconnected) {
        const near = nearestPoint(track, r.x, r.z, r.index);
        resolveWallContact(r, near, near.width ?? track.width, dt, false);
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
