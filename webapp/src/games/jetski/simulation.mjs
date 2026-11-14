// Shared deterministic watercraft simulation. The online server accepts inputs only.
import {
  LANA_CHANNEL_WIDTH,
  makeLanaPoints,
  nearestLana
} from './lanaCourse.mjs';

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
  },
  {
    id: 'lana',
    name: 'Lana River',
    subtitle: 'Central Tirana · bridges and narrow banks',
    width: LANA_CHANNEL_WIDTH / 2 - 0.65,
    wave: 0.12,
    length: '0.9 km',
    difficulty: 'River sprint'
  },
  {
    id: 'karaburun',
    name: 'Karaburun Headland',
    subtitle: 'Wide headland sweep · exposed swell',
    width: 22,
    wave: 0.69,
    difficulty: 'Open water'
  },
  {
    id: 'koman',
    name: 'Koman Gorge',
    subtitle: 'Cliff-lined bends · cross-current',
    width: 14,
    wave: 0.20,
    difficulty: 'Technical'
  }
];
export const CRAFTS = [
  {
    id: 'pulse',
    name: 'Pulse R',
    role: 'Balanced',
    speed: 33,
    acceleration: 13.4,
    handling: 1.58,
    color: '#32e2d1'
  },
  {
    id: 'surge',
    name: 'Surge GT',
    role: 'Top speed',
    speed: 36,
    acceleration: 13,
    handling: 1.42,
    color: '#ffab62'
  },
  {
    id: 'agile',
    name: 'Aero SX',
    role: 'Cornering',
    speed: 31,
    acceleration: 14.2,
    handling: 1.82,
    color: '#c6b4ff'
  }
];
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const normalizeTrack = (id) =>
  TRACKS.some((t) => t.id === id) ? id : 'ksamil';
export const normalizeCraft = (id) =>
  CRAFTS.some((c) => c.id === id) ? id : 'pulse';
const courseProfiles = {
  karaburun: {
    // An elongated offshore leg followed by a tighter turn around the headland.
    shape: (a) => ({
      x: 158 * Math.sin(a) + 24 * Math.sin(2 * a),
      z: 92 * Math.cos(a) + 16 * Math.sin(3 * a)
    }),
    current: { x: 0.55, z: 0.3 },
    ramps: [[44, -4], [147, 5], [202, -5]],
    pickups: [[25, -7], [90, 6], [175, -7], [219, 6]]
  },
  koman: {
    // A long, narrow circuit with alternating bends along its two shorelines.
    shape: (a) => ({
      x: 76 * Math.sin(a) + 17 * Math.sin(3 * a + 0.7),
      z: 150 * Math.cos(a) + 12 * Math.sin(2 * a)
    }),
    current: { x: -1.05, z: 0.45 },
    ramps: [[76, 3], [177, -3]],
    pickups: [[29, 4], [111, -5], [198, 4]]
  }
};

export function makeTrack(id) {
  const info = TRACKS.find((t) => t.id === normalizeTrack(id));
  const pointToPoint = info.id === 'lana';
  const profile = courseProfiles[info.id];
  const points = pointToPoint
    ? makeLanaPoints()
    : Array.from({ length: 240 }, (_, i) => {
        const a = (i / 240) * Math.PI * 2;
        if (profile) return profile.shape(a);
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
  const segmentCount = points.length - Number(pointToPoint);
  for (let i = 1; i <= segmentCount; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          points[i % points.length].x - points[i - 1].x,
          points[i % points.length].z - points[i - 1].z
        )
    );
  const track = {
    ...info,
    pointToPoint,
    laps: pointToPoint ? 1 : LAPS,
    points,
    lengths,
    totalLength: lengths[segmentCount],
    length: info.length ?? `${((lengths[segmentCount] * LAPS) / 1000).toFixed(1)} km`,
    current: profile?.current ?? { x: 0, z: 0 },
    gates: [],
    ramps: [],
    pickups: []
  };
  track.gates = Array.from({ length: 12 }, (_, i) =>
    sample(track, pointToPoint ? Math.round((i * segmentCount) / 11) : i * 20)
  );
  if (!pointToPoint)
    track.ramps = (profile?.ramps ?? [[51, 4], [166, -4]]).map(
      ([index, side]) => sample(track, index, side)
    );
  const offset = pointToPoint ? 1.4 : 5;
  track.pickups = (
    profile?.pickups ?? [[28, -offset], [105, offset], [202, -offset]]
  ).map(([index, side]) => sample(track, index, side));
  return track;
}
export function sample(track, index, offset = 0) {
  const count = track.points.length;
  const i = track.pointToPoint
    ? clamp(Math.floor(index), 0, count - 1)
    : ((Math.floor(index) % count) + count) % count;
  const p = track.points[i];
  const from = track.points[track.pointToPoint && i === count - 1 ? i - 1 : i];
  const to =
    track.points[track.pointToPoint && i === count - 1 ? i : (i + 1) % count];
  const heading = Math.atan2(to.x - from.x, to.z - from.z);
  return {
    x: p.x + Math.cos(heading) * offset,
    z: p.z - Math.sin(heading) * offset,
    heading,
    index: i
  };
}
export function nearest(track, x, z) {
  if (track.pointToPoint) return nearestLana(x, z);
  let best = 0,
    d2 = Infinity;
  for (let i = 0; i < track.points.length; i++) {
    const p = track.points[i],
      d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < d2) {
      d2 = d;
      best = i;
    }
  }
  return { index: best, distance: Math.sqrt(d2), ...track.points[best] };
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
function startPosition(track, slot) {
  const offset = track.pointToPoint
    ? slot % 2
      ? 1.35
      : -1.35
    : ((slot % 3) - 1) * 3.8;
  const grid = sample(track, 0, offset);
  const distance = 5 + Math.floor(slot / (track.pointToPoint ? 2 : 3)) * 5;
  return {
    x: grid.x - Math.sin(grid.heading) * distance,
    z: grid.z - Math.cos(grid.heading) * distance,
    heading: grid.heading,
    distance
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
  const { x, z, heading, distance } = startPosition(track, slot);
  return {
    id,
    name: String(name).slice(0, 18),
    slot,
    ai,
    craftId: normalizeCraft(craftId),
    x,
    z,
    heading,
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
    pickupAt: track.pickups.map(() => -99),
    rampAt: -99,
    recoveryAt: -99,
    hitAt: -99,
    crashes: 0,
    crash: null,
    input: neutralInput(),
    lastInput: 0
  };
}
export function aiInput(r, track, difficulty = 'club') {
  const n = nearest(track, r.x, r.z);
  const river = track.pointToPoint;
  const next = track.gates[r.nextGate];
  const nextIsAhead =
    (next.x - r.x) * Math.sin(next.heading) +
      (next.z - r.z) * Math.cos(next.heading) >
    0;
  const distancePerPoint =
    track.totalLength / (track.points.length - (river ? 1 : 0));
  const lookahead =
    (river ? 5 + r.speed * 0.28 : 12 + r.speed * 0.38) / distancePerPoint;
  const look = sample(
    track,
    n.index + Math.max(1, Math.ceil(lookahead)),
    Math.sin(r.slot * 7) * (river ? 1.05 : 3)
  );
  const courseHeading =
    n.index >= track.points.length - 1 && river
      ? look.heading
      : Math.atan2(look.x - r.x, look.z - r.z);
  // Straighten the hull to the direction of travel before it touches down.
  const desired =
    r.airborne && r.speed > 3 ? Math.atan2(r.vx, r.vz) : courseHeading;
  const currentCorrection = Math.atan2(
    track.current.x * Math.cos(desired) - track.current.z * Math.sin(desired),
    Math.max(r.speed, 8)
  );
  const angle = wrapAngle(desired - currentCorrection - r.heading);
  const pace =
    difficulty === 'rookie'
      ? 22 + r.slot * 0.4
      : difficulty === 'pro'
        ? 35
        : 30;
  const curve = Math.abs(
    wrapAngle(look.heading - sample(track, n.index).heading)
  );
  const target = river
    ? clamp(pace * (0.88 - curve * 1.35 - Math.abs(angle) * 0.44), 8, pace)
    : clamp(pace * (1 - curve * 0.55 - Math.abs(angle) * 0.28), 13, pace);
  return {
    steer: clamp(-angle * (river ? 2.6 : 1.9), -1, 1),
    throttle: r.speed < target,
    brake: r.speed > target + (river ? 1.8 : 3.5),
    boost:
      Math.abs(angle) < 0.12 &&
      curve < (river ? 0.06 : 0.2) &&
      r.speed > 15 &&
      r.boost > 32 &&
      difficulty !== 'rookie',
    recover:
      n.distance > track.width + 12 ||
      (river && !nextIsAhead && n.index > next.index + 2)
  };
}
function resetMotion(r, x, z, heading) {
  r.x = x;
  r.z = z;
  r.heading = heading;
  r.vx = r.vz = r.speed = r.verticalSpeed = r.height = r.steer = 0;
  r.airborne = false;
  r.boosting = false;
}
function recover(r, track, elapsed) {
  if (elapsed - r.recoveryAt < 4) return;
  if (!r.gatesPassed) {
    const start = startPosition(track, r.slot);
    resetMotion(r, start.x, start.z, start.heading);
  } else {
    const gates = track.gates;
    const p = gates[(r.nextGate + gates.length - 1) % gates.length];
    // Resume after the last accepted gate without skipping the next gate.
    resetMotion(
      r,
      p.x + Math.sin(p.heading) * 3,
      p.z + Math.cos(p.heading) * 3,
      p.heading
    );
  }
  r.recoveryAt = elapsed;
  r.penalty += 5;
}

function eject(r, elapsed, impact, bankX = 0, bankZ = 0) {
  if (r.crash) return;
  const outward = Math.max(0, r.vx * bankX + r.vz * bankZ);
  const vx = (r.vx - bankX * outward) * 0.44 - bankX * 2.2;
  const vz = (r.vz - bankZ * outward) * 0.44 - bankZ * 2.2;
  r.crash = {
    x: r.x - bankX * 0.4,
    z: r.z - bankZ * 0.4,
    height: r.height + 0.98,
    vx,
    vz,
    verticalSpeed: 2.5 + Math.min(1.7, impact * 0.09),
    heading: Math.hypot(vx, vz) > 0.5 ? Math.atan2(vx, vz) : r.heading,
    age: 0
  };
  r.hitAt = elapsed;
  r.crashes++;
  r.penalty += 3;
  r.boosting = false;
  r.vx *= 0.36;
  r.vz *= 0.36;
  r.speed = Math.hypot(r.vx, r.vz);
}

function bankContact(body, n, width) {
  if (n.distance <= width) return null;
  const nx = (body.x - n.x) / n.distance;
  const nz = (body.z - n.z) / n.distance;
  body.x = n.x + nx * width;
  body.z = n.z + nz * width;
  return { nx, nz, impact: Math.max(0, body.vx * nx + body.vz * nz) };
}

function remount(r, track) {
  const n = nearest(track, r.x, r.z);
  const next = track.gates[r.nextGate];
  const prev =
    track.gates[(r.nextGate + track.gates.length - 1) % track.gates.length];
  const count = track.points.length;
  const fromPrevious = (n.index - prev.index + count) % count;
  const segmentLength = (next.index - prev.index + count) % count;
  if (!r.gatesPassed) {
    const start = startPosition(track, r.slot);
    resetMotion(r, start.x, start.z, start.heading);
  } else if (fromPrevious > 0 && fromPrevious < segmentLength) {
    const p = sample(track, n.index);
    const lateral = Math.min(
      0.72,
      (track.width - 0.8) / Math.max(1, n.distance)
    );
    resetMotion(
      r,
      n.x + (r.x - n.x) * lateral,
      n.z + (r.z - n.z) * lateral,
      p.heading
    );
  } else {
    const p = sample(
      track,
      fromPrevious <= segmentLength + 6 ? next.index - 2 : prev.index + 1
    );
    resetMotion(r, p.x, p.z, p.heading);
  }
  r.crash = null;
}

function stepCrash(r, track, dt) {
  const crash = r.crash;
  crash.age += dt;
  if (crash.height > 0) {
    crash.verticalSpeed -= 9.81 * dt;
    crash.height = Math.max(0, crash.height + crash.verticalSpeed * dt);
  }
  const riderDrag = Math.exp(-dt * (crash.height > 0 ? 0.8 : 6));
  crash.vx *= riderDrag;
  crash.vz *= riderDrag;
  crash.x += crash.vx * dt;
  crash.z += crash.vz * dt;
  const hullDrag = Math.exp(-dt * 2.8);
  r.vx *= hullDrag;
  r.vz *= hullDrag;
  r.x += r.vx * dt;
  r.z += r.vz * dt;
  r.speed = Math.hypot(r.vx, r.vz);
  r.steer *= hullDrag;
  if (r.airborne) {
    r.verticalSpeed -= 9.81 * dt;
    r.height = Math.max(0, r.height + r.verticalSpeed * dt);
    if (r.height === 0) {
      r.airborne = false;
      r.verticalSpeed = 0;
    }
  }
  if (track.pointToPoint) {
    const craftContact = bankContact(r, nearest(track, r.x, r.z), track.width);
    if (craftContact) {
      r.vx -= craftContact.nx * craftContact.impact;
      r.vz -= craftContact.nz * craftContact.impact;
      r.speed = Math.hypot(r.vx, r.vz);
    }
    const riderContact = bankContact(
      crash,
      nearest(track, crash.x, crash.z),
      track.width + 0.25
    );
    if (riderContact) {
      crash.vx -= riderContact.nx * riderContact.impact;
      crash.vz -= riderContact.nz * riderContact.impact;
    }
  }
  if (crash.age >= 2.4) remount(r, track);
}

function finishRace(r, elapsed) {
  r.finished = true;
  r.finishTime = elapsed + r.penalty;
  r.boosting = false;
}

function crossGate(r, track, elapsed) {
  r.gatesPassed++;
  if (r.nextGate === 0) {
    if (r.lap > 0) {
      const lapTime = elapsed - r.lapStarted;
      r.bestLap = r.bestLap ? Math.min(r.bestLap, lapTime) : lapTime;
    }
    r.lap++;
    r.lapStarted = elapsed;
    if (r.lap > (track.laps ?? LAPS)) finishRace(r, elapsed);
  }
  const lastGate = r.nextGate === track.gates.length - 1;
  if (lastGate && track.pointToPoint) {
    r.bestLap = elapsed - r.lapStarted;
    finishRace(r, elapsed);
  } else {
    r.nextGate = (r.nextGate + 1) % track.gates.length;
  }
}

function hullReach(r, nx, nz) {
  const along = Math.sin(r.heading) * nx + Math.cos(r.heading) * nz;
  return Math.sqrt(0.72 ** 2 + (1.52 ** 2 - 0.72 ** 2) * along ** 2);
}

function checkGate(r, track, elapsed, oldX, oldZ) {
  const gate = track.gates[r.nextGate];
  const headingX = Math.sin(gate.heading);
  const headingZ = Math.cos(gate.heading);
  const before = (oldX - gate.x) * headingX + (oldZ - gate.z) * headingZ;
  const after = (r.x - gate.x) * headingX + (r.z - gate.z) * headingZ;
  if (before < 0 && after >= 0) {
    const fraction = -before / (after - before);
    const crossX = oldX + (r.x - oldX) * fraction;
    const crossZ = oldZ + (r.z - oldZ) * fraction;
    const gateDistance = Math.hypot(crossX - gate.x, crossZ - gate.z);
    if (gateDistance < track.width + (track.pointToPoint ? 0.9 : 2)) {
      crossGate(r, track, elapsed);
    }
  }
}

function updateProgress(r, track) {
  // Gate count leads ranking. Proximity only breaks ties within that gate segment.
  const next = track.gates[r.nextGate];
  r.progress = r.gatesPassed * 1000 - Math.hypot(r.x - next.x, r.z - next.z);
}

export function stepRace(racers, track, dt, elapsed, difficulty = 'club') {
  dt = clamp(dt, 0, STEP);
  const gateCandidates = [];
  for (const r of racers) {
    if (r.finished) continue;
    if (r.crash) {
      stepCrash(r, track, dt);
      updateProgress(r, track);
      continue;
    }
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
    const headingX = Math.sin(r.heading);
    const headingZ = Math.cos(r.heading);
    const forward = r.vx * headingX + r.vz * headingZ;
    const cap = spec.speed * (r.boosting ? 1.24 : 1);
    const thrust =
      input.throttle && !input.brake
        ? spec.acceleration *
          (r.boosting ? 1.55 : 1) *
          clamp((cap + 4 - forward) / 4, 0, 1) *
          (r.airborne ? 0.15 : 1)
        : 0;
    const drag = r.airborne
      ? 0.1
      : 0.16 + Math.abs(forward) * 0.005 + (input.brake ? 1.65 : 0);
    r.vx += (headingX * thrust - r.vx * drag) * dt;
    r.vz += (headingZ * thrust - r.vz * drag) * dt;
    const grip =
      1 - Math.exp(-dt * (r.airborne ? 0.35 : 6 - Math.abs(r.steer) * 1.25));
    const side = r.vx * headingZ - r.vz * headingX;
    r.vx -= headingZ * side * grip;
    r.vz += headingX * side * grip;
    // Positive input turns visually right from a rear chase / rider-eye view.
    r.heading -=
      r.steer *
      spec.handling *
      clamp(Math.abs(forward) / 9, 0, 1) *
      (r.airborne ? 0.24 : input.throttle || input.brake ? 1 : 0.76) *
      (1 - clamp((r.speed - 19) * 0.013, 0, 0.27)) *
      dt;
    r.speed = Math.hypot(r.vx, r.vz);
    const maximum = spec.speed * 1.25;
    if (r.speed > maximum) {
      r.vx *= maximum / r.speed;
      r.vz *= maximum / r.speed;
      r.speed = maximum;
    }
    const currentGrip = r.airborne ? 0 : 1;
    r.x += (r.vx + track.current.x * currentGrip) * dt;
    r.z += (r.vz + track.current.z * currentGrip) * dt;
    if (r.airborne) {
      r.verticalSpeed -= 9.81 * dt;
      r.height += r.verticalSpeed * dt;
      r.jumpDistance += r.speed * dt;
      if (r.height <= 0) {
        r.height = 0;
        r.airborne = false;
        const landingImpact = -r.verticalSpeed;
        r.verticalSpeed = 0;
        if (landingImpact > 7.3 && Math.abs(side) > 5.5) {
          eject(r, elapsed, landingImpact);
          continue;
        }
        r.landings++;
        r.vx *= 0.92;
        r.vz *= 0.92;
        r.speed *= 0.92;
        // Aligned landings keep momentum and earn a small refill.
        if (Math.abs(side) < 3.5 && r.jumpDistance > 12)
          r.boost = clamp(r.boost + 12, 0, 100);
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
    const n = nearest(track, r.x, r.z);
    if (track.pointToPoint) {
      const contact = bankContact(r, n, track.width);
      if (contact) {
        if (contact.impact > 7.5) {
          eject(r, elapsed, contact.impact, contact.nx, contact.nz);
          continue;
        }
        if (contact.impact > 2.2) r.hitAt = elapsed;
        r.vx -= contact.nx * contact.impact * 1.18;
        r.vz -= contact.nz * contact.impact * 1.18;
        r.speed = Math.hypot(r.vx, r.vz);
      }
    } else if (n.distance > track.width) {
      const excess = n.distance - track.width;
      r.vx *= Math.exp(-dt * 1.7);
      r.vz *= Math.exp(-dt * 1.7);
      r.x += ((n.x - r.x) / n.distance) * Math.min(excess, dt * 6);
      r.z += ((n.z - r.z) / n.distance) * Math.min(excess, dt * 6);
      r.speed = Math.hypot(r.vx, r.vz);
      if (excess > 22) {
        recover(r, track, elapsed);
        updateProgress(r, track);
        continue;
      }
    }
    gateCandidates.push({ r, oldX, oldZ });
  }
  for (let i = 0; i < racers.length; i++)
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i],
        b = racers[j];
      if (
        a.finished ||
        b.finished ||
        a.crash ||
        b.crash ||
        Math.abs(a.height - b.height) > 0.85
      )
        continue;
      const dx = b.x - a.x,
        dz = b.z - a.z,
        d = Math.hypot(dx, dz);
      if (d < 3.04) {
        const nx = d > 0.001 ? dx / d : Math.sin(a.heading),
          nz = d > 0.001 ? dz / d : Math.cos(a.heading),
          overlap = (hullReach(a, nx, nz) + hullReach(b, nx, nz) - d) * 0.5;
        if (overlap <= 0) continue;
        a.x -= nx * overlap;
        a.z -= nz * overlap;
        b.x += nx * overlap;
        b.z += nz * overlap;
        if (track.pointToPoint) {
          bankContact(a, nearest(track, a.x, a.z), track.width);
          bankContact(b, nearest(track, b.x, b.z), track.width);
        }
        const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (closing > 0) {
          const impulse = closing * 0.56;
          a.vx -= nx * impulse;
          a.vz -= nz * impulse;
          b.vx += nx * impulse;
          b.vz += nz * impulse;
          if (closing > 15) {
            eject(a, elapsed, closing);
            eject(b, elapsed, closing);
            continue;
          }
          a.speed = Math.hypot(a.vx, a.vz);
          b.speed = Math.hypot(b.vx, b.vz);
          a.hitAt = b.hitAt = elapsed;
        }
      }
    }
  for (const { r, oldX, oldZ } of gateCandidates) {
    if (!r.crash) checkGate(r, track, elapsed, oldX, oldZ);
    updateProgress(r, track);
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
