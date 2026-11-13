// Shared deterministic watercraft simulation. The online server accepts inputs only.
export const STEP = 1 / 60;
export const RACE_LIMIT = 300;
export const LAPS = 3;
export const TRACKS = [
  {
    id: 'ksamil',
    name: 'Ksamil Islands',
    subtitle: 'Turquoise water · flowing corners',
    width: 17,
    wave: 0.23,
    length: '1.9 km',
    difficulty: 'Flow'
  },
  {
    id: 'dhermi',
    name: 'Dhërmi Coast',
    subtitle: 'Open sea · bigger waves',
    width: 15,
    wave: 0.46,
    length: '2.3 km',
    difficulty: 'Technical'
  },
  {
    id: 'harbor',
    name: 'Vlorë Marina',
    subtitle: 'Tight turns · sheltered water',
    width: 13,
    wave: 0.14,
    length: '1.7 km',
    difficulty: 'Precision'
  }
];
export const CRAFTS = [
  {
    id: 'pulse',
    name: 'Pulse R',
    role: 'Balanced',
    speed: 31,
    acceleration: 11,
    handling: 1.45,
    color: '#32e2d1'
  },
  {
    id: 'surge',
    name: 'Surge GT',
    role: 'Top speed',
    speed: 34,
    acceleration: 9.5,
    handling: 1.28,
    color: '#ffab62'
  },
  {
    id: 'agile',
    name: 'Aero SX',
    role: 'Cornering',
    speed: 29,
    acceleration: 12,
    handling: 1.7,
    color: '#c6b4ff'
  }
];
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const normalizeTrack = (id) =>
  TRACKS.some((t) => t.id === id) ? id : 'ksamil';
export const normalizeCraft = (id) =>
  CRAFTS.some((c) => c.id === id) ? id : 'pulse';
export function makeTrack(id) {
  const info = TRACKS.find((t) => t.id === normalizeTrack(id));
  const points = Array.from({ length: 240 }, (_, i) => {
    const a = (i / 240) * Math.PI * 2;
    const radius =
      info.id === 'dhermi'
        ? 110 + 18 * Math.sin(a * 3)
        : info.id === 'harbor'
          ? 83 + 14 * Math.sin(a * 2)
          : 96 + 10 * Math.sin(a * 3);
    return {
      x: Math.sin(a) * radius,
      z: Math.cos(a) * radius * (info.id === 'dhermi' ? 1.12 : 0.93)
    };
  });
  const lengths = [0];
  for (let i = 1; i <= points.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          points[i % 240].x - points[i - 1].x,
          points[i % 240].z - points[i - 1].z
        )
    );
  const track = {
    ...info,
    points,
    lengths,
    totalLength: lengths[240],
    gates: [],
    ramps: [],
    pickups: []
  };
  track.gates = Array.from({ length: 12 }, (_, i) => sample(track, i * 20));
  track.ramps = [sample(track, 51, 4), sample(track, 166, -4)];
  track.pickups = [
    sample(track, 28, -5),
    sample(track, 105, 5),
    sample(track, 202, -4)
  ];
  return track;
}
export function sample(track, index, offset = 0) {
  const i = ((Math.floor(index) % 240) + 240) % 240;
  const p = track.points[i],
    next = track.points[(i + 1) % 240];
  const heading = Math.atan2(next.x - p.x, next.z - p.z);
  return {
    x: p.x + Math.cos(heading) * offset,
    z: p.z - Math.sin(heading) * offset,
    heading,
    index: i
  };
}
export function nearest(track, x, z) {
  let best = 0,
    d2 = Infinity;
  for (let i = 0; i < 240; i++) {
    const p = track.points[i],
      d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < d2) {
      d2 = d;
      best = i;
    }
  }
  return { index: best, distance: Math.sqrt(d2) };
}
export function waterHeight(x, z, time, wave = 0.23) {
  return (
    wave *
    (Math.sin(x * 0.075 + time * 1.9) * 0.6 +
      Math.sin(z * 0.12 - time * 1.45) * 0.3 +
      Math.sin((x + z) * 0.19 + time * 2.6) * 0.1)
  );
}
export const neutralInput = () => ({
  steer: 0,
  throttle: false,
  brake: false,
  boost: false,
  recover: false
});
export function sanitizeInput(data = {}) {
  return {
    steer: Number.isFinite(data.steer) ? clamp(data.steer, -1, 1) : 0,
    throttle: data.throttle === true,
    brake: data.brake === true,
    boost: data.boost === true,
    recover: data.recover === true
  };
}
export function createRacer(
  track,
  id,
  name,
  slot,
  ai = false,
  craftId = 'pulse'
) {
  const grid = sample(track, 0, ((slot % 3) - 1) * 3.8);
  const distance = 5 + Math.floor(slot / 3) * 5;
  return {
    id,
    name: String(name).slice(0, 18),
    slot,
    ai,
    craftId: normalizeCraft(craftId),
    x: grid.x - Math.sin(grid.heading) * distance,
    z: grid.z - Math.cos(grid.heading) * distance,
    heading: grid.heading,
    vx: 0,
    vz: 0,
    speed: 0,
    steer: 0,
    boost: 100,
    boosting: false,
    height: 0,
    verticalSpeed: 0,
    airborne: false,
    landings: 0,
    jumpDistance: 0,
    nextGate: 0,
    gatesPassed: 0,
    lap: 0,
    lapStarted: 0,
    bestLap: 0,
    finishTime: 0,
    finished: false,
    disconnected: false,
    penalty: 0,
    progress: -distance,
    pickupAt: [-99, -99, -99],
    rampAt: -99,
    recoveryAt: -99,
    hitAt: -99,
    input: neutralInput(),
    lastInput: 0
  };
}
export function aiInput(r, track, difficulty = 'club') {
  const n = nearest(track, r.x, r.z);
  const look = sample(
    track,
    n.index + 5 + r.speed * 0.18,
    Math.sin(r.slot * 7) * 3
  );
  const angle = wrapAngle(Math.atan2(look.x - r.x, look.z - r.z) - r.heading);
  const target =
    difficulty === 'rookie'
      ? 21 + r.slot * 0.4
      : difficulty === 'pro'
        ? 33
        : 27;
  return {
    steer: clamp(-angle * 1.8, -1, 1),
    throttle: r.speed < target || Math.abs(angle) < 0.35,
    brake: Math.abs(angle) > 0.82 && r.speed > 17,
    boost: Math.abs(angle) < 0.13 && r.boost > 32 && difficulty !== 'rookie',
    recover: n.distance > track.width + 12
  };
}
function recover(r, track, elapsed) {
  if (elapsed - r.recoveryAt < 4) return;
  const p = track.gates[(r.nextGate + 11) % 12];
  // Resume immediately AFTER the last accepted gate; never award a gate by resetting.
  r.x = p.x + Math.sin(p.heading) * 3;
  r.z = p.z + Math.cos(p.heading) * 3;
  r.heading = p.heading;
  r.vx = r.vz = r.speed = r.verticalSpeed = r.height = 0;
  r.airborne = false;
  r.recoveryAt = elapsed;
  r.penalty += 5;
}
export function stepRace(racers, track, dt, elapsed, difficulty = 'club') {
  dt = clamp(dt, 0, STEP);
  for (const r of racers) {
    if (r.finished) continue;
    const input = r.disconnected
      ? { ...neutralInput(), brake: true }
      : r.ai
        ? aiInput(r, track, difficulty)
        : sanitizeInput(r.input);
    if (input.recover) recover(r, track, elapsed);
    const spec = CRAFTS.find((c) => c.id === r.craftId) || CRAFTS[0];
    const oldX = r.x,
      oldZ = r.z;
    r.steer += (input.steer - r.steer) * Math.min(1, dt * 8);
    r.boosting =
      input.boost &&
      input.throttle &&
      r.boost > 1 &&
      !r.airborne &&
      !input.brake;
    r.boost = clamp(r.boost + dt * (r.boosting ? -24 : 5), 0, 100);
    const forward = r.vx * Math.sin(r.heading) + r.vz * Math.cos(r.heading);
    const thrust =
      input.throttle && !input.brake
        ? spec.acceleration * (r.boosting ? 1.7 : 1)
        : 0;
    const drag = 0.18 + Math.abs(forward) * 0.006 + (input.brake ? 1.7 : 0);
    r.vx += (Math.sin(r.heading) * thrust - r.vx * drag) * dt;
    r.vz += (Math.cos(r.heading) * thrust - r.vz * drag) * dt;
    const grip = 1 - Math.exp(-dt * (r.airborne ? 0.4 : 3.8));
    const side = r.vx * Math.cos(r.heading) - r.vz * Math.sin(r.heading);
    r.vx -= Math.cos(r.heading) * side * grip;
    r.vz += Math.sin(r.heading) * side * grip;
    // Positive input turns visually right from a rear chase / rider-eye view.
    r.heading -=
      r.steer *
      spec.handling *
      clamp(Math.abs(forward) / 12, 0, 1) *
      (r.airborne ? 0.28 : 1) *
      dt;
    r.speed = Math.hypot(r.vx, r.vz);
    const cap = spec.speed * (r.boosting ? 1.28 : 1);
    if (r.speed > cap) {
      r.vx *= cap / r.speed;
      r.vz *= cap / r.speed;
      r.speed = cap;
    }
    r.x += r.vx * dt;
    r.z += r.vz * dt;
    if (r.airborne) {
      r.verticalSpeed -= 9.81 * dt;
      r.height += r.verticalSpeed * dt;
      r.jumpDistance += r.speed * dt;
      if (r.height <= 0) {
        r.height = 0;
        r.airborne = false;
        r.verticalSpeed = 0;
        r.landings++;
        r.vx *= 0.92;
        r.vz *= 0.92;
      }
    } else if (elapsed - r.rampAt > 3 && r.speed > 12) {
      for (const ramp of track.ramps)
        if (
          Math.hypot(r.x - ramp.x, r.z - ramp.z) < 3.6 &&
          Math.cos(r.heading - ramp.heading) > 0.6
        ) {
          r.airborne = true;
          r.height = 0.12;
          r.verticalSpeed = 5.4 + r.speed * 0.08;
          r.rampAt = elapsed;
          r.jumpDistance = 0;
          break;
        }
    }
    track.pickups.forEach((p, i) => {
      if (
        elapsed - r.pickupAt[i] > 18 &&
        Math.hypot(r.x - p.x, r.z - p.z) < 3.2
      ) {
        r.boost = clamp(r.boost + 35, 0, 100);
        r.pickupAt[i] = elapsed;
      }
    });
    const n = nearest(track, r.x, r.z),
      center = track.points[n.index];
    if (n.distance > track.width) {
      const excess = n.distance - track.width;
      r.vx *= Math.exp(-dt * 1.7);
      r.vz *= Math.exp(-dt * 1.7);
      r.x += ((center.x - r.x) / n.distance) * Math.min(excess, dt * 6);
      r.z += ((center.z - r.z) / n.distance) * Math.min(excess, dt * 6);
      if (excess > 22) recover(r, track, elapsed);
    }
    const gate = track.gates[r.nextGate];
    const before =
      (oldX - gate.x) * Math.sin(gate.heading) +
      (oldZ - gate.z) * Math.cos(gate.heading);
    const after =
      (r.x - gate.x) * Math.sin(gate.heading) +
      (r.z - gate.z) * Math.cos(gate.heading);
    if (
      before < 0 &&
      after >= 0 &&
      Math.hypot(r.x - gate.x, r.z - gate.z) < track.width + 2
    ) {
      r.gatesPassed++;
      if (r.nextGate === 0) {
        if (r.lap > 0) {
          const lapTime = elapsed - r.lapStarted;
          r.bestLap = r.bestLap ? Math.min(r.bestLap, lapTime) : lapTime;
        }
        r.lap++;
        r.lapStarted = elapsed;
        if (r.lap > LAPS) {
          r.finished = true;
          r.finishTime = elapsed + r.penalty;
          r.boosting = false;
        }
      }
      r.nextGate = (r.nextGate + 1) % 12;
    }
    // Gate count leads ranking. Proximity only breaks ties within that gate segment.
    const next = track.gates[r.nextGate];
    r.progress = r.gatesPassed * 1000 - Math.hypot(r.x - next.x, r.z - next.z);
  }
  for (let i = 0; i < racers.length; i++)
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i],
        b = racers[j];
      if (a.finished || b.finished || Math.abs(a.height - b.height) > 1)
        continue;
      const dx = b.x - a.x,
        dz = b.z - a.z,
        d = Math.hypot(dx, dz);
      if (d < 2.2 && d > 0.001) {
        const nx = dx / d,
          nz = dz / d,
          overlap = (2.2 - d) * 0.5;
        a.x -= nx * overlap;
        a.z -= nz * overlap;
        b.x += nx * overlap;
        b.z += nz * overlap;
        const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (closing > 0) {
          a.vx -= nx * closing * 0.6;
          a.vz -= nz * closing * 0.6;
          b.vx += nx * closing * 0.6;
          b.vz += nz * closing * 0.6;
          a.hitAt = b.hitAt = elapsed;
        }
      }
    }
}
export const standings = (racers) =>
  [...racers].sort(
    (a, b) =>
      Number(b.finished) - Number(a.finished) ||
      (a.finished ? a.finishTime - b.finishTime : b.progress - a.progress)
  );
export const formatTime = (time) =>
  `${Math.floor(time / 60)}:${(time % 60).toFixed(2).padStart(5, '0')}`;
