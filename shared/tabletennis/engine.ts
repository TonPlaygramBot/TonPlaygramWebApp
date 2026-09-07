/** Deterministic singles table tennis. Metres, seconds; shared 240 Hz physics. */
import {
  HALF_WIDTH,
  HALF_LENGTH,
  TABLE_HEIGHT,
  BALL_RADIUS,
  GRAVITY,
  NET_HEIGHT,
  TABLE_GRIP,
  TABLE_RESTITUTION,
  initialScore,
  awardPoint,
  opponent,
  type Seat,
  type Score
} from './rules.js';
import { advanceBall, ballAtRest, gravity, type Contact } from './physics.js';
export * from './rules.js';
export type Shot = 'drive' | 'topspin' | 'backspin' | 'smash';
export type Input = {
  moveX: number | null;
  moveZ: number | null;
  aim: number;
  power: number;
  shot: Shot;
  swing: number;
  assist: boolean;
  autoHit: boolean;
  /** Unit heading projected from the actual finger vector, in court coordinates. */
  direction?: { x: number; z: number } | null;
};
export type MatchConfig = {
  ai: boolean;
  difficulty: number;
  gamesToWin: number;
  seed: number;
  upgrades: number[];
  firstServer: Seat;
};
export type MatchState = {
  config: MatchConfig;
  phase: 'serve' | 'toss' | 'rally' | 'point' | 'over';
  time: number;
  remainder: number;
  phaseAt: number;
  endsSwapped: boolean;
  players: {
    x: number;
    z: number;
    swingAt: number;
    swingId: number;
    queued: number;
    queuedInput: Input | null;
    hitX: number;
    hitY: number;
    hitZ: number;
  }[];
  ball: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    last: Seat;
    bounces: number;
    serve: boolean;
    serveStage: number;
    netTouch: boolean;
    spin: number;
  };
  score: Score;
  inputs: Input[];
  events: { id: number; type: string; seat: Seat; label: string }[];
  eventId: number;
  message: string;
  winner: Seat | null;
  lastPoint: Seat | null;
  rally: number;
  bestRally: number;
  rng: number;
  aiAim: number;
  aiError: number;
  aiThink: number;
  pointCount: number;
  serveInput: Input | null;
  gamePlayTime: number;
  receiverReturns: number;
};
export const side = (seat: Seat, state?: { endsSwapped: boolean }) =>
  (seat === 0 ? 1 : -1) * (state?.endsSwapped ? -1 : 1);
export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
export const neutralInput = (): Input => ({
  moveX: null,
  moveZ: null,
  aim: 0,
  power: 0.5,
  shot: 'drive',
  swing: 0,
  assist: true,
  autoHit: true,
  direction: null
});
export function createMatch(config: Partial<MatchConfig> = {}): MatchState {
  const c: MatchConfig = {
    ai: true,
    difficulty: 1,
    gamesToWin: 2,
    upgrades: [0, 0, 0],
    seed: 41237,
    firstServer: 0,
    ...config
  };
  c.gamesToWin = [1, 2, 3].includes(c.gamesToWin) ? c.gamesToWin : 2;
  c.difficulty = clamp(
    Number.isFinite(c.difficulty) ? Math.floor(c.difficulty) : 1,
    0,
    2
  );
  c.firstServer = c.firstServer === 1 ? 1 : 0;
  const s: MatchState = {
    config: c,
    phase: 'serve',
    time: 0,
    remainder: 0,
    phaseAt: 0,
    endsSwapped: false,
    players: [0, 1].map((n) => ({
      x: 0,
      z: n === 0 ? 1.7 : -1.7,
      swingAt: -10,
      swingId: 0,
      queued: -10,
      queuedInput: null,
      hitX: 0,
      hitY: 1.1,
      hitZ: 0
    })),
    ball: {
      x: 0,
      y: 1.04,
      z: 1.58,
      vx: 0,
      vy: 0,
      vz: 0,
      last: c.firstServer,
      bounces: 0,
      serve: true,
      serveStage: 0,
      netTouch: false,
      spin: 0
    },
    score: initialScore(c.firstServer),
    inputs: [neutralInput(), neutralInput()],
    events: [],
    eventId: 0,
    message: 'Your serve',
    winner: null,
    lastPoint: null,
    rally: 0,
    bestRally: 0,
    rng: c.seed >>> 0,
    aiAim: 0,
    aiError: 0,
    aiThink: 0,
    pointCount: 0,
    serveInput: null,
    gamePlayTime: 0,
    receiverReturns: 0
  };
  resetPoint(s);
  return s;
}
function rand(s: MatchState) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
function event(s: MatchState, type: string, seat: Seat, label: string) {
  s.events.push({ id: ++s.eventId, type, seat, label });
  if (s.events.length > 12) s.events.shift();
}
function clearSwings(s: MatchState) {
  s.players.forEach((p) => {
    p.queued = -10;
    p.queuedInput = null;
  });
}
export function setInput(s: MatchState, seat: Seat, p: Partial<Input>) {
  if (seat !== 0 && seat !== 1) return;
  const old = s.inputs[seat],
    finite = (v: unknown, fallback: number) =>
      typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const swing =
    Number.isSafeInteger(p.swing) && p.swing! >= old.swing
      ? p.swing!
      : old.swing;
  const raw = p.direction === undefined ? old.direction : p.direction;
  const norm =
    raw && Number.isFinite(raw.x) && Number.isFinite(raw.z)
      ? Math.hypot(raw.x, raw.z)
      : 0;
  s.inputs[seat] = {
    moveX:
      p.moveX === undefined
        ? old.moveX
        : p.moveX === null
          ? null
          : clamp(finite(p.moveX, old.moveX ?? 0), -1.12, 1.12),
    moveZ:
      p.moveZ === undefined
        ? (old.moveZ ?? null)
        : p.moveZ === null
          ? null
          : side(seat, s) *
            clamp(
              finite(p.moveZ, old.moveZ ?? side(seat, s) * 1.7) * side(seat, s),
              1.55,
              2.27
            ),
    aim: clamp(finite(p.aim, old.aim), -1, 1),
    power: clamp(finite(p.power, old.power), 0.1, 1),
    shot: ['drive', 'topspin', 'backspin', 'smash'].includes(p.shot || '')
      ? p.shot!
      : old.shot,
    swing,
    assist: typeof p.assist === 'boolean' ? p.assist : old.assist,
    autoHit: typeof p.autoHit === 'boolean' ? p.autoHit : old.autoHit,
    direction:
      raw && norm > 0.001 && Number.isFinite(norm)
        ? { x: raw.x / norm, z: raw.z / norm }
        : null
  };
  if (swing > old.swing) {
    s.players[seat].swingId = swing;
    if (s.phase === 'serve' || s.phase === 'rally') {
      s.players[seat].queued = s.time;
      s.players[seat].queuedInput = structuredClone(s.inputs[seat]);
    }
  }
}
function point(s: MatchState, winner: Seat, label: string) {
  if (s.phase === 'over' || s.phase === 'point') return;
  const previousGames = s.score.history.length;
  const over = awardPoint(s.score, winner, s.config.gamesToWin);
  if (previousGames !== s.score.history.length) s.gamePlayTime = 0;
  s.phase = over ? 'over' : 'point';
  s.phaseAt = s.time;
  s.message = label;
  s.pointCount++;
  s.winner = over ? winner : null;
  s.lastPoint = winner;
  clearSwings(s);
  event(s, over ? 'win' : 'point', winner, label);
}
function letPoint(s: MatchState, label: string) {
  s.phase = 'point';
  s.phaseAt = s.time;
  s.message = label;
  s.lastPoint = null;
  clearSwings(s);
  event(s, 'let', s.score.server, label);
}
function resetPoint(s: MatchState) {
  if (s.endsSwapped !== s.score.endsSwapped) {
    s.endsSwapped = s.score.endsSwapped;
    s.players.forEach((p) => {
      p.x = -p.x;
      p.z = -p.z;
    });
  }
  const seat = s.score.server;
  s.phase = 'serve';
  s.phaseAt = s.time;
  s.rally = 0;
  s.receiverReturns = 0;
  s.serveInput = null;
  s.message = seat === 0 ? 'Your serve' : 'Opponent serves';
  s.players.forEach((p, n) => {
    p.z = side(n as Seat, s) * 1.7;
    p.x = clamp(p.x, -0.45, 0.45);
  });
  Object.assign(s.ball, {
    x: s.players[seat].x,
    y: 1.04,
    z: side(seat, s) * 1.58,
    vx: 0,
    vy: 0,
    vz: 0,
    last: seat,
    bounces: 0,
    serve: true,
    serveStage: 0,
    netTouch: false,
    spin: 0
  });
  clearSwings(s);
}
function toss(s: MatchState) {
  const seat = s.score.server;
  s.serveInput = structuredClone(s.players[seat].queuedInput || s.inputs[seat]);
  s.phase = 'toss';
  s.phaseAt = s.time;
  s.ball.vy = 2.15;
  clearSwings(s);
  event(s, 'serve', seat, 'Serve');
}
function recordHit(s: MatchState, seat: Seat, input: Input, serve: boolean) {
  const b = s.ball;
  Object.assign(s.players[seat], {
    swingAt: s.time,
    queued: -10,
    queuedInput: null,
    hitX: b.x,
    hitY: b.y,
    hitZ: b.z
  });
  b.last = seat;
  b.bounces = 0;
  b.serve = serve;
  b.serveStage = 0;
  b.netTouch = false;
  s.phase = 'rally';
  s.phaseAt = s.time;
  s.rally++;
  s.bestRally = Math.max(s.rally, s.bestRally);
  s.aiThink = s.time + [0.24, 0.14, 0.07][s.config.difficulty];
  s.aiAim = (rand(s) * 2 - 1) * 0.9;
  s.aiError = (rand(s) * 2 - 1) * [0.18, 0.07, 0.02][s.config.difficulty];
  if (rand(s) < [0.08, 0.035, 0.01][s.config.difficulty])
    s.aiError += (rand(s) > 0.5 ? 1 : -1) * 0.7;
  s.message = serve ? 'Serve' : 'Rally';
  event(s, 'hit', seat, serve ? 'Serve' : input.shot);
}
function serve(s: MatchState) {
  const seat = s.score.server,
    b = s.ball,
    i = s.serveInput || s.inputs[seat],
    sign = side(seat, s);
  const heading = i.direction || { x: i.aim * 0.16, z: -sign };
  const norm = Math.hypot(heading.x, heading.z),
    pace = 2.4 + clamp(i.power, 0.1, 1) * 2.8;
  b.vx = (heading.x / norm) * pace;
  b.vz = (heading.z / norm) * pace;
  const forwardPace = -b.vz * sign;
  let flight = 0.34;
  if (forwardPace > 0.5) {
    // Solve both bounces together, while preserving the swipe heading and pace.
    const end = b.z * sign,
      depth = 0.4 + i.power * 0.72;
    const e = TABLE_RESTITUTION * TABLE_GRIP,
      a = 1 + e;
    const c =
      (2 * e * (b.y - TABLE_HEIGHT - BALL_RADIUS) * forwardPace ** 2) / GRAVITY;
    const root = Math.sqrt(Math.max(0, (end + depth) ** 2 - 4 * a * c));
    const distances = [
      (end + depth - root) / (2 * a),
      (end + depth + root) / (2 * a)
    ];
    const distance =
      distances.find((d) => end - d > 0.2 && end - d < HALF_LENGTH - 0.03) ||
      distances[1];
    flight = Math.max(0.08, distance / forwardPace);
  }
  b.vy =
    (TABLE_HEIGHT + BALL_RADIUS - b.y + (GRAVITY * flight * flight) / 2) /
    flight;
  b.spin = 0;
  recordHit(s, seat, i, true);
}
function shot(s: MatchState, seat: Seat) {
  const b = s.ball,
    p = s.players[seat],
    ai = seat === 1 && s.config.ai;
  const i =
    ai || s.inputs[seat].autoHit
      ? s.inputs[seat]
      : p.queuedInput || s.inputs[seat];
  if (b.bounces !== 1 || b.last === seat || (b.serve && b.serveStage !== 2))
    return;
  const power = clamp(
    i.power + (seat === 0 ? (s.config.upgrades[1] || 0) * 0.04 : 0),
    0.1,
    1
  );
  const depth =
    i.shot === 'backspin' ? 0.35 + power * 0.45 : 0.45 + power * 0.65;
  const x = i.aim * (i.shot === 'smash' ? 0.65 : 0.61) + (ai ? s.aiError : 0),
    z = -side(seat, s) * depth;
  const length = Math.hypot(x - b.x, z - b.z),
    heading = i.direction;
  const dx = heading ? heading.x * length : x - b.x,
    dz = heading ? heading.z * length : z - b.z;
  const pace =
    (i.shot === 'backspin' ? 2.5 : 3) + power * (i.shot === 'smash' ? 9 : 7);
  b.spin = i.shot === 'topspin' ? 0.85 : i.shot === 'backspin' ? -0.75 : 0;
  const g = gravity(b);
  let flight = Math.max(0.15, length / pace);
  const netFraction = -b.z / dz;
  if (netFraction > 0 && netFraction < 1) {
    const base =
      b.y * (1 - netFraction) + (TABLE_HEIGHT + BALL_RADIUS) * netFraction;
    const clearance = TABLE_HEIGHT + NET_HEIGHT + BALL_RADIUS + 0.035;
    flight = Math.max(
      flight,
      Math.sqrt(
        Math.max(
          0,
          (2 * (clearance - base)) / (g * netFraction * (1 - netFraction))
        )
      )
    );
  }
  b.vx = dx / flight;
  b.vz = dz / flight;
  b.vy =
    (TABLE_HEIGHT + BALL_RADIUS - b.y + (g * flight * flight) / 2) / flight;
  recordHit(s, seat, i, false);
}
function contact(s: MatchState, c: Contact) {
  if (c.kind === 'net') {
    event(s, 'net', s.ball.last, 'Net contact');
    return;
  }
  if (c.kind === 'table' || c.kind === 'edge') {
    const b = s.ball,
      landed: Seat = c.z * side(0, s) >= 0 ? 0 : 1;
    event(
      s,
      'bounce',
      landed,
      c.kind === 'edge' ? 'Top edge · in' : 'Table bounce'
    );
    if (s.phase !== 'rally') return;
    if (b.serve) {
      if (b.serveStage >= 2) {
        point(s, b.last, 'Second bounce');
        return;
      }
      if (landed !== (b.serveStage === 0 ? b.last : opponent(b.last))) {
        point(s, opponent(b.last), 'Service fault');
        return;
      }
      b.serveStage++;
      if (b.serveStage === 2) {
        b.bounces = 1;
        if (b.netTouch) {
          letPoint(s, 'Let · serve again');
          return;
        }
      }
    } else {
      if (b.bounces >= 1) {
        point(s, b.last, 'Second bounce');
        return;
      }
      if (landed === b.last) {
        point(s, opponent(b.last), 'Wrong side of the table');
        return;
      }
      b.bounces = 1;
      if (
        s.score.expedite &&
        b.last !== s.score.server &&
        ++s.receiverReturns >= 13
      ) {
        point(s, b.last, 'Expedite · 13 returns');
        return;
      }
    }
    if (b.bounces === 1 && b.vy === 0) point(s, b.last, 'Unreturned');
  } else if (s.phase === 'rally') {
    point(
      s,
      s.ball.bounces === 1 ? s.ball.last : opponent(s.ball.last),
      c.kind === 'side'
        ? 'Vertical side · out'
        : s.ball.bounces === 1
          ? 'Unreturned'
          : s.ball.serve
            ? 'Service fault'
            : 'Out'
    );
  }
}
function movePlayers(s: MatchState, dt: number) {
  const b = s.ball;
  for (const seat of [0, 1] as Seat[]) {
    const p = s.players[seat],
      input = s.inputs[seat],
      ai = seat === 1 && s.config.ai;
    const incoming = b.last !== seat && s.phase === 'rally',
      sign = side(seat, s);
    if (ai) {
      const other = s.players[0];
      input.aim =
        s.config.difficulty === 2 ? (other.x > 0 ? -0.92 : 0.92) : s.aiAim;
      input.direction = null;
      input.power = [0.3, 0.55, 0.85][s.config.difficulty];
      input.shot =
        b.y > 1.12 && s.config.difficulty === 2
          ? 'smash'
          : s.rally % 4 === 0
            ? 'backspin'
            : 'topspin';
    }
    let target = input.moveX ?? p.x;
    if ((ai && s.time >= s.aiThink) || (!ai && input.assist)) {
      const t = Math.max(0, Math.min(0.45, (sign * 1.22 - b.z) / (b.vz || 1)));
      target = incoming ? b.x + b.vx * t : 0;
    }
    const speed = ai
      ? [2.2, 3.1, 4][s.config.difficulty]
      : 2.8 + (s.config.upgrades[0] || 0) * 0.22;
    p.x = clamp(
      p.x + clamp(target - p.x, -speed * dt, speed * dt),
      -1.12,
      1.12
    );
    const targetZ =
      input.assist || ai
        ? sign * (incoming ? clamp(b.z * sign + 0.48, 1.55, 2.27) : 1.7)
        : (input.moveZ ?? p.z);
    p.z += clamp(targetZ - p.z, -speed * dt, speed * dt);
    const queued = s.time - p.queued < 0.7;
    if (
      incoming &&
      b.z * sign > 0.78 &&
      b.z * sign < 2.15 &&
      Math.abs(p.z - b.z) < 0.9 &&
      b.y > TABLE_HEIGHT + 0.03 &&
      b.y < 1.8 &&
      Math.abs(p.x - b.x) <
        0.37 + (seat === 0 ? (s.config.upgrades[2] || 0) * 0.025 : 0)
    ) {
      if (b.bounces === 1 && (ai || input.autoHit || queued)) shot(s, seat);
      // Early gestures are buffered; the paddle only strikes after a legal bounce.
    }
  }
}
function step(s: MatchState, dt: number) {
  if (s.phase === 'over' && ballAtRest(s.ball)) return;
  s.time += dt;
  if (s.phase === 'point' || s.phase === 'over') {
    advanceBall(s.ball, dt, (c) => contact(s, c));
    if (s.phase !== 'over' && s.time - s.phaseAt >= 1.25) resetPoint(s);
    return;
  }
  if (s.phase === 'serve') {
    const server = s.score.server;
    s.ball.x = clamp(s.players[server].x, -0.55, 0.55);
    if (
      (server === 1 && s.config.ai && s.time - s.phaseAt > 0.9) ||
      s.time - s.players[server].queued < 0.7
    )
      toss(s);
    return;
  }
  s.gamePlayTime += dt;
  if (
    !s.score.expedite &&
    s.gamePlayTime >= 600 &&
    s.score.points[0] + s.score.points[1] < 18
  ) {
    s.score.expedite = true;
    s.score.expediteServer = s.score.server;
    s.score.expediteBase = s.score.points[0] + s.score.points[1];
    letPoint(s, 'Expedite · same serve');
    return;
  }
  if (s.phase === 'toss') {
    s.ball.y += s.ball.vy * dt - (GRAVITY * dt * dt) / 2;
    s.ball.vy -= GRAVITY * dt;
    if (s.ball.vy < 0 && s.ball.y <= 0.98) {
      s.ball.y = 0.98;
      serve(s);
    }
    return;
  }
  advanceBall(s.ball, dt, (c) => contact(s, c));
  if (s.phase !== 'rally') return;
  const b = s.ball;
  const missedEnd =
    b.bounces === 0 && b.z * side(b.last, s) < -HALF_LENGTH - BALL_RADIUS;
  if (missedEnd || Math.abs(b.z) > 4 || Math.abs(b.x) > 3.2) {
    point(
      s,
      b.bounces === 1 ? b.last : opponent(b.last),
      b.bounces === 1 ? 'Unreturned' : b.serve ? 'Service fault' : 'Out'
    );
    return;
  }
  movePlayers(s, dt);
}
export function advance(s: MatchState, elapsed: number) {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return;
  s.remainder += Math.min(elapsed, 0.1);
  const dt = 1 / 240;
  while (s.remainder + 1e-12 >= dt) {
    s.remainder -= dt;
    step(s, dt);
  }
  if (Math.abs(s.remainder) < 1e-12) s.remainder = 0;
}
