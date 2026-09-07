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
export const TRACKS = [
  {
    id: 'harbor',
    name: 'Harbor Run',
    district: 'PORT DISTRICT',
    x: 94,
    z: 66,
    bend: 0.08,
    width: 18,
    sky: '#9eaaa6',
    ground: '#394b47',
    accent: '#baff29'
  },
  {
    id: 'neon',
    name: 'Neon District',
    district: 'DOWNTOWN',
    x: 84,
    z: 79,
    bend: 0.24,
    width: 16,
    sky: '#171d32',
    ground: '#242937',
    accent: '#6accff'
  },
  {
    id: 'canyon',
    name: 'Canyon Rush',
    district: 'THE OUTSKIRTS',
    x: 112,
    z: 60,
    bend: 0.17,
    width: 17,
    sky: '#d5bfa1',
    ground: '#ad7950',
    accent: '#ffb968'
  },
  {
    id: 'alpine',
    name: 'Alpine Pass',
    district: 'SNOWLINE SUMMIT',
    x: 88,
    z: 72,
    bend: 0.31,
    width: 15,
    sky: '#b9d5e4',
    ground: '#d7e2e4',
    accent: '#ff4b3e'
  },
  {
    id: 'coast',
    name: 'Azure Coast',
    district: 'MEDITERRANEAN',
    x: 106,
    z: 67,
    bend: 0.27,
    width: 16,
    sky: '#79c9ed',
    ground: '#c8ad76',
    accent: '#25e0d0'
  }
];
export const CUPS = [
  {
    name: 'Rookie Cup',
    track: 'harbor',
    difficulty: 'rookie',
    target: 3,
    reward: 150
  },
  {
    name: 'Street Cup',
    track: 'neon',
    difficulty: 'street',
    target: 3,
    reward: 250
  },
  {
    name: 'Royale Cup',
    track: 'canyon',
    difficulty: 'pro',
    target: 1,
    reward: 500
  }
];
export const POWERUPS = ['rocket', 'shield', 'repair', 'nitro'];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function makeTrack(id = 'harbor') {
  const config = TRACKS.find((t) => t.id === id) || TRACKS[0];
  const points = Array.from({ length: 360 }, (_, i) => {
    const a = (i / 360) * Math.PI * 2,
      w = 1 + config.bend * Math.cos(a * 3 + 0.6);
    return { x: Math.cos(a) * config.x * w, z: Math.sin(a) * config.z * w };
  });
  let length = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % 360];
    p.yaw = Math.atan2(q.x - p.x, q.z - p.z);
    p.distance = length;
    length += Math.hypot(q.x - p.x, q.z - p.z);
  });
  return { ...config, points, length };
}
export function nearestPoint(track, x, z) {
  let index = 0,
    distanceSq = Infinity;
  for (let i = 0; i < 360; i++) {
    const p = track.points[i],
      d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < distanceSq) {
      index = i;
      distanceSq = d;
    }
  }
  const p = track.points[index];
  return {
    index,
    distance: Math.sqrt(distanceSq),
    lane: (x - p.x) * -Math.cos(p.yaw) + (z - p.z) * Math.sin(p.yaw)
  };
}
export function createRacer(track, id, name, slot = 0, ai = false) {
  const index = 355 - Math.floor(slot / 2) * 4,
    p = track.points[index],
    lane = slot % 2 ? 2.1 : -2.1;
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
    lap: 0,
    nextGate: 0,
    gates: 0,
    index,
    progress: (index - 360) / 360,
    finished: false,
    finishTime: 0,
    collision: 0,
    health: 100,
    shield: 0,
    weapon: null,
    weaponCooldown: 0,
    hitFlash: 0,
    input: { steer: 0, brake: false, drift: false, boost: false, use: false },
    lastInput: 0,
    disconnected: false
  };
}
export function aiInput(r, track, time, difficulty = 'street') {
  const n = nearestPoint(track, r.x, r.z),
    p = track.points[(n.index + 9 + Math.floor(r.speed * 0.12)) % 360],
    lane = Math.sin(time * 0.31 + r.slot * 2) * 2.1;
  const turn = wrapAngle(
    Math.atan2(
      p.x - Math.cos(p.yaw) * lane - r.x,
      p.z + Math.sin(p.yaw) * lane - r.z
    ) - r.yaw
  );
  return {
    steer: clamp(-turn * 2.6, -1, 1),
    brake: Math.abs(turn) > 0.65 && r.speed > 20,
    drift:
      Math.abs(turn) > 0.18 && Math.abs(turn) < 0.55 && difficulty !== 'rookie',
    boost: Math.abs(turn) < 0.08 && r.boost > 60 && difficulty !== 'rookie'
  };
}
// Positive input steers visually RIGHT in a chase camera looking along +Z.
// Both clients and server use this fixed-step simulation; scores are never accepted.
export function stepRacer(r, raw, track, dt, time, difficulty = 'street') {
  if (r.finished || r.disconnected) return;
  const input = raw || {},
    steer = Number.isFinite(input.steer) ? clamp(input.steer, -1, 1) : 0;
  const previousSpeed = r.speed;
  r.health = Number.isFinite(r.health) ? r.health : 100;
  r.shield = Math.max(0, (r.shield || 0) - dt);
  r.weaponCooldown = Math.max(0, (r.weaponCooldown || 0) - dt);
  r.hitFlash = Math.max(0, (r.hitFlash || 0) - dt);
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
    damageFactor = 0.62 + r.health * 0.0038,
    max = (boost || r.turbo > 0 ? 43 : 31) * factor * damageFactor;
  r.speed = clamp(
    r.speed +
      (input.brake
        ? -28
        : (boost || r.turbo > 0 ? 22 : 13.8) * factor -
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
  const near = nearestPoint(track, r.x, r.z),
    p = track.points[near.index],
    limit = track.width / 2 - 1.2;
  r.collision = Math.max(0, r.collision - dt);
  if (near.distance > limit) {
    const d = Math.max(0.001, near.distance);
    r.x = p.x + ((r.x - p.x) / d) * limit;
    r.z = p.z + ((r.z - p.z) / d) * limit;
    r.speed *= Math.exp(-2.7 * dt);
    r.yaw += wrapAngle(p.yaw - r.yaw) * Math.min(1, dt * 4);
    r.velocityYaw += wrapAngle(p.yaw - r.velocityYaw) * Math.min(1, dt * 8);
    r.collision = 0.2;
  }
  r.acceleration = clamp((r.speed - previousSpeed) / dt, -35, 25);
  // Sequential quarter-track gates reject shortcuts and finish-line oscillation.
  const delta = ((near.index - r.index + 540) % 360) - 180;
  if (delta > 0 && delta < 24) {
    const crossed = (r.nextGate * 90 - r.index + 360) % 360;
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
    : Math.max(-1, r.lap - 1) + near.index / 360;
}
export function collectPowerup(r, kind) {
  if (!POWERUPS.includes(kind)) return false;
  if (kind === 'repair') {
    if (r.health >= 100) return false;
    r.health = Math.min(100, r.health + 38);
  } else if (kind === 'shield') {
    r.shield = Math.max(r.shield || 0, 6);
  } else if (kind === 'nitro') {
    r.turbo = Math.max(r.turbo || 0, 3.2);
    r.boost = Math.min(100, (r.boost || 0) + 35);
  } else r.weapon = 'rocket';
  return true;
}
export function damageRacer(r, amount) {
  if (r.shield > 0) {
    r.shield = Math.max(0, r.shield - amount * 0.035);
    return 0;
  }
  const damage = Math.min(r.health, amount);
  r.health -= damage;
  r.speed *= Math.max(0.35, 1 - damage / 90);
  r.hitFlash = 0.45;
  return damage;
}
export function useWeapon(r, racers) {
  if (r.weapon !== 'rocket' || r.weaponCooldown > 0) return null;
  const targets = racers
    .filter((other) => other !== r && !other.finished && !other.disconnected)
    .map((other) => ({
      racer: other,
      distance: Math.hypot(other.x - r.x, other.z - r.z),
      angle: Math.abs(
        wrapAngle(Math.atan2(other.x - r.x, other.z - r.z) - r.yaw)
      )
    }))
    .filter((candidate) => candidate.distance < 42 && candidate.angle < 0.7)
    .sort((a, b) => a.distance - b.distance)[0];
  if (!targets) return null;
  r.weapon = null;
  r.weaponCooldown = 0.7;
  damageRacer(targets.racer, 34);
  return targets.racer.id;
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
  for (const r of racers) {
    if (r.input?.use) useWeapon(r, racers);
    // Four collectible lanes repeat each lap. Cooldown prevents recollecting
    // while a kart remains over the same pickup gate.
    const gate = Math.round(r.index / 45) * 45;
    if (Math.abs(r.index - gate) <= 1 && r.weaponCooldown <= 0) {
      const kind =
        POWERUPS[(gate / 45 + Math.max(0, r.lap - 1)) % POWERUPS.length];
      if (collectPowerup(r, kind)) r.weaponCooldown = 1.2;
    }
  }
  for (let i = 0; i < racers.length; i++)
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i],
        b = racers[j];
      if (a.finished || b.finished || a.disconnected || b.disconnected)
        continue;
      let dx = a.x - b.x,
        dz = a.z - b.z,
        d = Math.hypot(dx, dz);
      if (d < 2.05) {
        if (d < 0.001) {
          dx = 1;
          dz = 0;
          d = 1;
        }
        const push = (2.05 - d) * 0.5;
        a.x += (dx / d) * push;
        a.z += (dz / d) * push;
        b.x -= (dx / d) * push;
        b.z -= (dz / d) * push;
        a.speed *= 0.992;
        b.speed *= 0.992;
        if (Math.max(a.speed, b.speed) > 18) {
          damageRacer(a, 0.09);
          damageRacer(b, 0.09);
        }
        a.collision = b.collision = 0.15;
      }
    }
}
export const standings = (racers) =>
  [...racers].sort(
    (a, b) =>
      Number(b.finished) - Number(a.finished) ||
      (a.finished && b.finished
        ? a.finishTime - b.finishTime
        : Number(a.disconnected) - Number(b.disconnected) ||
          b.progress - a.progress)
  );
