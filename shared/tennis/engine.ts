import {
  BALL_RADIUS,
  GRAVITY,
  REVIEW_SECONDS,
  groundTime,
  bounceVelocity,
  lineCall,
  reviewActive,
  type CloseCall,
  type Review
} from './court.js';
import { aiSpeed, predictIntercept, planAiShot } from './ai.js';
export {
  BALL_RADIUS,
  GRAVITY,
  HALF_WIDTH,
  HALF_LENGTH,
  SERVICE,
  CONTACT_RADIUS,
  REVIEW_SECONDS,
  reviewActive
} from './court.js';
export type Seat = 0 | 1;
export type Shot = 'flat' | 'topspin' | 'slice' | 'lob';
export type Surface = 'hard' | 'clay' | 'grass';
export type Phase = 'serve' | 'toss' | 'rally' | 'point' | 'over';
export type Input = {
  moveX: number | null;
  moveZ: number | null;
  aim: number;
  power: number;
  shot: Shot;
  swing: number;
  assist: boolean;
  /** Unit direction on the court, projected from the finger vector. Null = soft/legacy aimed shot. */
  direction?: { x: number; z: number } | null;
  depth?: number;
};
export type Score = {
  points: number[];
  games: number[];
  sets: number[];
  history: number[][];
  tie: boolean;
  server: Seat;
  tieServer: Seat;
  totalPoints: number;
};
export type Player = {
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  swingAt: number;
  swingId: number;
  queued: number;
  stamina: number;
  lastInput: number;
  queuedInput: Input | null;
};
export type Event = {
  id: number;
  type: 'hit' | 'bounce' | 'point' | 'win' | 'fault' | 'serve';
  seat: Seat;
  label: string;
};
export type MatchConfig = {
  ai: boolean;
  difficulty: number;
  surface: Surface;
  gamesToWin: number;
  setsToWin: number;
  upgrades: number[];
  seed: number;
};
export type MatchState = {
  config: MatchConfig;
  time: number;
  phase: Phase;
  phaseAt: number;
  players: Player[];
  ball: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    bounces: number;
    last: Seat;
    serve: boolean;
    netTouch: boolean;
    spin: number;
  };
  score: Score;
  inputs: Input[];
  events: Event[];
  eventId: number;
  message: string;
  winner: Seat | null;
  lastPoint: Seat | null;
  fault: number;
  rally: number;
  bestRally: number;
  rng: number;
  pointCount: number;
  aiThink: number;
  serveInput: Input | null;
  closeCall: CloseCall | null;
  review: Review | null;
};
export const opponent = (p: Seat): Seat => (p === 0 ? 1 : 0);
export const side = (p: Seat) => (p === 0 ? 1 : -1);
export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
export const neutralInput = (): Input => ({
  moveX: null,
  moveZ: null,
  aim: 0,
  power: 0.55,
  shot: 'flat',
  swing: 0,
  assist: true
});
export function initialScore(): Score {
  return {
    points: [0, 0],
    games: [0, 0],
    sets: [0, 0],
    history: [],
    tie: false,
    server: 0,
    tieServer: 0,
    totalPoints: 0
  };
}
export function pointLabels(s: Score): string[] {
  if (s.tie) return s.points.map(String);
  if (s.points[0] >= 3 && s.points[1] >= 3)
    return s.points[0] === s.points[1]
      ? ['40', '40']
      : s.points.map((n, i) => (n > s.points[1 - i] ? 'AD' : '40'));
  return s.points.map((n) => ['0', '15', '30', '40'][Math.min(n, 3)]);
}
/** Mutates only the supplied score. A tie-break starts at gamesToWin all. */
export function awardPoint(
  s: Score,
  win: Seat,
  gamesToWin: number,
  setsToWin: number
): { winner: Seat | null; game: boolean; set: boolean } {
  s.points[win]++;
  s.totalPoints++;
  const other = opponent(win),
    target = s.tie ? 7 : 4;
  if (s.tie) {
    const n = s.points[0] + s.points[1];
    s.server =
      Math.floor((n + 1) / 2) % 2 === 0 ? s.tieServer : opponent(s.tieServer);
  }
  if (s.points[win] < target || s.points[win] - s.points[other] < 2)
    return { winner: null, game: false, set: false };
  const wasTie = s.tie;
  s.games[win]++;
  s.points = [0, 0];
  s.server = wasTie ? opponent(s.tieServer) : opponent(s.server);
  if (
    wasTie ||
    (s.games[win] >= gamesToWin &&
      (gamesToWin === 1 || s.games[win] - s.games[other] >= 2))
  ) {
    s.history.push([...s.games]);
    s.sets[win]++;
    s.games = [0, 0];
    s.tie = false;
    return {
      winner: s.sets[win] >= setsToWin ? win : null,
      game: true,
      set: true
    };
  }
  if (s.games[0] === gamesToWin && s.games[1] === gamesToWin) {
    s.tie = true;
    s.tieServer = s.server;
  }
  return { winner: null, game: true, set: false };
}
export function createMatch(config: Partial<MatchConfig> = {}): MatchState {
  const c: MatchConfig = {
    ai: true,
    difficulty: 2,
    surface: 'hard',
    gamesToWin: 1,
    setsToWin: 1,
    upgrades: [0, 0, 0],
    seed: 42117,
    ...config
  };
  c.difficulty = clamp(Math.floor(c.difficulty) || 0, 0, 2);
  const state: MatchState = {
    config: c,
    time: 0,
    phase: 'serve',
    phaseAt: 0,
    players: [0, 1].map((i) => ({
      x: 0,
      z: i === 0 ? 11 : -10,
      targetX: 0,
      targetZ: i === 0 ? 11 : -10,
      swingAt: -10,
      swingId: 0,
      queued: 0,
      stamina: 1,
      lastInput: 0,
      queuedInput: null
    })),
    ball: {
      x: 0,
      y: 1.2,
      z: 11,
      vx: 0,
      vy: 0,
      vz: 0,
      bounces: 0,
      last: 0,
      serve: true,
      netTouch: false,
      spin: 0
    },
    score: initialScore(),
    inputs: [neutralInput(), neutralInput()],
    events: [],
    eventId: 0,
    message: 'Your serve',
    winner: null,
    lastPoint: null,
    fault: 0,
    rally: 0,
    bestRally: 0,
    rng: c.seed || 1,
    pointCount: 0,
    aiThink: 0,
    serveInput: null,
    closeCall: null,
    review: null
  };
  setupServe(state);
  return state;
}
function random(s: MatchState) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
function emit(s: MatchState, type: Event['type'], seat: Seat, label: string) {
  s.events.push({ id: ++s.eventId, type, seat, label });
  if (s.events.length > 8) s.events.shift();
}
function setupServe(s: MatchState) {
  const seat = s.score.server,
    sign = side(seat),
    deuce = (s.score.points[0] + s.score.points[1]) % 2 === 0;
  s.phase = 'serve';
  s.phaseAt = s.time;
  s.rally = 0;
  s.serveInput = null;
  s.closeCall = null;
  if (!reviewActive(s)) s.review = null;
  s.aiThink = s.time + [0.3, 0.18, 0.1][s.config.difficulty];
  s.players[seat].x = sign * (deuce ? 1.8 : -1.8);
  s.players[seat].z = sign * 12.4;
  s.players[opponent(seat)].x = -s.players[seat].x * 0.6;
  s.players[opponent(seat)].z = -sign * 10.6;
  s.players.forEach((p) => {
    p.targetX = p.x;
    p.targetZ = p.z;
    p.queued = 0;
    p.queuedInput = null;
    p.stamina = Math.min(1, p.stamina + 0.3);
  });
  s.ball = {
    x: s.players[seat].x,
    y: 1.25,
    z: s.players[seat].z - 0.3 * sign,
    vx: 0,
    vy: 0,
    vz: 0,
    bounces: 0,
    last: seat,
    serve: true,
    netTouch: false,
    spin: 0
  };
  s.message = s.fault
    ? 'Second serve'
    : seat === 0
      ? 'Your serve'
      : 'Opponent serves';
}
function startReview(s: MatchState) {
  if (!s.closeCall) return;
  s.review = { ...s.closeCall, id: s.eventId + 1, startedAt: s.time };
  s.closeCall = null;
  // No live input can leak into the next point while the broadcast is running.
  s.players.forEach((p) => {
    p.queued = 0;
    p.queuedInput = null;
  });
}
function finishPoint(s: MatchState, win: Seat, reason: string) {
  if (s.phase === 'point' || s.phase === 'over') return;
  s.lastPoint = win;
  s.bestRally = Math.max(s.bestRally, s.rally);
  s.pointCount++;
  s.fault = 0;
  const result = awardPoint(
    s.score,
    win,
    s.config.gamesToWin,
    s.config.setsToWin
  );
  s.phase = result.winner !== null ? 'over' : 'point';
  s.phaseAt = s.time;
  startReview(s);
  if (s.review) s.phaseAt += REVIEW_SECONDS - 0.75;
  s.winner = result.winner;
  s.ball.vx = 0;
  s.ball.vy = 0;
  s.ball.vz = 0;
  const prefix =
    result.winner !== null
      ? 'Match'
      : result.set
        ? 'Set'
        : result.game
          ? 'Game'
          : 'Point';
  s.message = `${reason} · ${prefix} ${win === 0 ? 'you' : 'opponent'}`;
  emit(s, result.winner !== null ? 'win' : 'point', win, s.message);
}
function fault(s: MatchState, reason: string) {
  s.fault++;
  if (s.fault >= 2) {
    finishPoint(s, opponent(s.score.server), 'Double fault');
    return;
  }
  emit(s, 'fault', s.score.server, reason);
  startReview(s);
  setupServe(s);
  if (reviewActive(s)) s.phaseAt += REVIEW_SECONDS;
  s.message = `${reason} · second serve`;
}
function trajectory(s: MatchState, seat: Seat, input: Input, isServe: boolean) {
  const b = s.ball,
    sign = side(seat),
    ai = seat === 1 && s.config.ai;
  const power = clamp(input.power, 0.1, 1),
    shot = isServe ? 'flat' : input.shot;
  if (isServe) {
    b.x = s.players[seat].x;
    b.z = s.players[seat].z - 0.5 * sign;
    b.y = 2.7;
  }
  let depth = isServe ? 2.6 + power * 2.9 : 1.8 + power * 8.4;
  if (!isServe && input.depth !== undefined) depth = 1.8 + input.depth * 8.8;
  if (shot === 'slice') depth = Math.min(depth, 5.5);
  if (shot === 'lob') depth = 9.6;
  let x = isServe
    ? -s.players[seat].x * 0.85 + input.aim * 1.1
    : input.aim * (ai && s.config.difficulty === 2 ? 4.05 : 3.65);
  const z = -sign * depth;
  // Legacy/button shots retain placement. Human finger shots have no random aim error.
  if (ai && !isServe)
    x += (random(s) - 0.5) * [0.65, 0.28, 0.09][s.config.difficulty];
  let dx = x - b.x,
    dz = z - b.z;
  const length = Math.hypot(dx, dz);
  const direction = input.direction;
  if (direction && Math.hypot(direction.x, direction.z) > 0.5) {
    // Never snap a sideways or backwards gesture to a different heading.
    dx = direction.x * length;
    dz = direction.z * length;
  }
  const pace =
    (shot === 'lob' ? 7.5 : shot === 'slice' ? 8.5 : 9) +
    power * (isServe ? 11 : 16);
  let flight = Math.max(0.65, length / pace);
  if (shot === 'lob') flight = Math.max(flight, 2.15 - power * 0.45);
  // Increase the arc, not horizontal speed, when a soft touch needs net clearance.
  const netFraction = -b.z / dz;
  if (netFraction > 0 && netFraction < 1) {
    const netY = 1.16 + (shot === 'topspin' ? 0.28 : 0.08);
    const baseY = b.y * (1 - netFraction) + BALL_RADIUS * netFraction;
    const clearFlight = Math.sqrt(
      Math.max(
        0,
        (2 * (netY - baseY)) / (GRAVITY * netFraction * (1 - netFraction))
      )
    );
    flight = Math.max(flight, clearFlight);
  }
  b.vx = dx / flight;
  b.vz = dz / flight;
  b.vy = (BALL_RADIUS - b.y + 0.5 * GRAVITY * flight * flight) / flight;
  // Lower levels can make physical unforced errors; Pro retains bounded accuracy.
  if (ai && !isServe && random(s) < [0.1, 0.035, 0.006][s.config.difficulty])
    b.vy -= 3;
  b.bounces = 0;
  b.last = seat;
  b.serve = isServe;
  b.netTouch = false;
  b.spin = shot === 'topspin' ? 0.8 : shot === 'slice' ? -0.6 : 0;
  s.rally++;
  s.players[seat].swingAt = s.time;
  s.players[seat].queued = 0;
  s.players[seat].queuedInput = null;
  s.aiThink = s.time + [0.28, 0.16, 0.085][s.config.difficulty];
  s.players[seat].stamina = Math.max(0.25, s.players[seat].stamina - 0.07);
  s.phase = 'rally';
  s.phaseAt = s.time;
  s.message = isServe
    ? 'Serve'
    : shot === 'topspin'
      ? 'Topspin'
      : shot === 'slice'
        ? 'Slice'
        : shot === 'lob'
          ? 'Lob'
          : 'Rally';
  emit(s, isServe ? 'serve' : 'hit', seat, shot);
}
export function setInput(s: MatchState, seat: Seat, input: Input) {
  const p = s.players[seat];
  const swing = Number.isFinite(input.swing)
    ? Math.floor(input.swing)
    : p.swingId;
  const rawDirection = input.direction;
  const norm =
    rawDirection &&
    Number.isFinite(rawDirection.x) &&
    Number.isFinite(rawDirection.z)
      ? Math.hypot(rawDirection.x, rawDirection.z)
      : 0;
  s.inputs[seat] = {
    moveX:
      input.moveX === null ? null : clamp(Number(input.moveX) || 0, -5.2, 5.2),
    moveZ:
      input.moveZ === null
        ? null
        : clamp(Number(input.moveZ) || 0, 1.8, 13.3) * side(seat),
    aim: clamp(Number(input.aim) || 0, -1, 1),
    power: clamp(Number.isFinite(input.power) ? input.power : 0.1, 0.1, 1),
    direction:
      rawDirection && norm > 0.001
        ? { x: rawDirection.x / norm, z: rawDirection.z / norm }
        : null,
    depth: Number.isFinite(input.depth) ? clamp(input.depth!, 0, 1) : undefined,
    shot: ['flat', 'topspin', 'slice', 'lob'].includes(input.shot)
      ? input.shot
      : 'flat',
    swing,
    assist: !!input.assist
  };
  p.lastInput = s.time;
  if (swing > p.swingId) {
    p.swingId = swing;
    if (!reviewActive(s) && s.phase !== 'point' && s.phase !== 'over') {
      p.queued = s.time + 0.85;
      p.queuedInput = { ...s.inputs[seat] };
    }
  }
}
function movePlayers(s: MatchState, dt: number) {
  for (const seat of [0, 1] as Seat[]) {
    const p = s.players[seat],
      inp = s.inputs[seat],
      sign = side(seat),
      incoming = s.ball.last !== seat && s.phase === 'rally';
    const ai = seat === 1 && s.config.ai;
    const assisted = ai || inp.assist;
    if (s.phase === 'serve' || s.phase === 'toss') continue;
    let speed = ai
      ? aiSpeed(s.config.difficulty)
      : 7.2 + (s.config.upgrades[0] || 0) * 0.35;
    if (incoming && assisted && (!ai || s.time >= s.aiThink)) {
      const intercept = predictIntercept(
        s,
        seat,
        speed * (0.78 + p.stamina * 0.22)
      );
      p.targetX = intercept.x;
      p.targetZ = intercept.z;
      if (ai) {
        s.aiThink = s.time + [0.28, 0.16, 0.085][s.config.difficulty];
        p.queued = s.time + 0.5;
      }
    } else if (!incoming && assisted) {
      p.targetX = ai ? clamp(s.ball.x * 0.35, -1.65, 1.65) : 0;
      p.targetZ = sign * (ai && s.ball.spin < 0 ? 8.2 : 10.5);
    }
    if (!ai && !inp.assist && inp.moveX !== null && s.time - p.lastInput < 0.22)
      p.targetX = inp.moveX;
    if (!ai && !inp.assist && inp.moveZ !== null && s.time - p.lastInput < 0.22)
      p.targetZ = inp.moveZ;
    speed *= 0.78 + p.stamina * 0.22;
    const dx = p.targetX - p.x,
      dz = p.targetZ - p.z,
      d = Math.hypot(dx, dz),
      step = Math.min(d, speed * dt);
    if (d > 0.015) {
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
    }
    p.stamina = Math.min(1, p.stamina + dt * 0.035);
    if (
      incoming &&
      p.queued >= s.time &&
      (s.ball.bounces > 0 || !s.ball.serve) &&
      s.ball.z * sign > 0.7 &&
      s.ball.y > 0.22 &&
      (!ai || s.ball.y >= 0.7 || s.ball.vy < 0) &&
      s.ball.y < 2.7 &&
      Math.hypot(p.x - s.ball.x, p.z - s.ball.z) <
        (ai ? 1.85 : 2.05) +
          (seat === 0 ? (s.config.upgrades[2] || 0) * 0.1 : 0)
    ) {
      const input = ai
        ? planAiShot(s, random(s) * 2 - 1)
        : p.queuedInput || inp;
      trajectory(s, seat, input, false);
    }
  }
}
export function stepMatch(s: MatchState, dt = 1 / 120) {
  if (s.phase === 'over' && !reviewActive(s)) return;
  dt = clamp(dt, 0, 1 / 30);
  s.time += dt;
  if (reviewActive(s)) return;
  s.review = null;
  if (s.phase === 'over') return;
  if (s.phase === 'point') {
    if (s.time - s.phaseAt > 1.55) setupServe(s);
    return;
  }
  const server = s.score.server,
    p = s.players[server];
  if (s.phase === 'serve') {
    if (
      (s.config.ai && server === 1 && s.time - s.phaseAt > 1.35) ||
      p.queued >= s.time
    ) {
      s.phase = 'toss';
      s.phaseAt = s.time;
      s.serveInput =
        s.config.ai && server === 1
          ? planAiShot(s, random(s) * 2 - 1, true)
          : { ...(p.queuedInput || s.inputs[server]) };
      p.queued = 0;
    }
    return;
  }
  if (s.phase === 'toss') {
    const t = s.time - s.phaseAt;
    s.ball.y = 1.25 + Math.sin(Math.min(1, t / 0.65) * Math.PI * 0.65) * 1.6;
    if (t >= 0.6) trajectory(s, server, s.serveInput || neutralInput(), true);
    return;
  }
  const b = s.ball;
  const landing = groundTime(b);
  const netTime = b.vz === 0 ? Infinity : -b.z / b.vz;
  const travel = Math.min(dt, landing);
  // Resolve the earliest exact intersection, so frame size cannot move a line call.
  if (netTime > 1e-9 && netTime <= travel) {
    const nx = b.x + b.vx * netTime;
    const ny = b.y + b.vy * netTime - (GRAVITY * netTime * netTime) / 2;
    if (Math.abs(nx) < 5.6 && ny < 0.98 + BALL_RADIUS) {
      if (b.serve && ny > 0.86) {
        b.netTouch = true;
        b.x = nx;
        b.z = Math.sign(b.vz) * 0.001;
        b.y = ny;
        b.vz *= 0.82;
        b.vy = Math.max(b.vy - GRAVITY * netTime, 1.5);
        return;
      }
      if (b.serve) fault(s, 'Net');
      else finishPoint(s, opponent(b.last), 'Net');
      return;
    }
  }
  b.x += b.vx * travel;
  b.z += b.vz * travel;
  b.y += b.vy * travel - (GRAVITY * travel * travel) / 2;
  b.vy -= GRAVITY * travel;
  if (landing <= dt) {
    b.y = BALL_RADIUS;
    const rebound = bounceVelocity(b, s.config.surface, b.spin);
    if (b.bounces === 0) {
      const call = lineCall(b.x, b.z, b.last, b.serve, s.players[b.last].x);
      if (call.close && !b.netTouch)
        s.closeCall = {
          call,
          impact: { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz },
          rebound,
          players: s.players.map(({ x, z }) => ({ x, z })),
          flightTime: Math.min(0.65, s.time - s.phaseAt - dt + travel)
        };
      if (!call.in) {
        if (b.serve) fault(s, 'Service out');
        else finishPoint(s, opponent(b.last), 'Out');
        return;
      }
      if (b.serve && b.netTouch) {
        emit(s, 'fault', b.last, 'Let');
        setupServe(s);
        s.message = 'Let · serve again';
        return;
      }
    } else {
      finishPoint(s, b.last, s.rally === 1 ? 'Ace' : 'Second bounce');
      return;
    }
    b.bounces++;
    Object.assign(b, rebound);
    const rest = dt - travel;
    b.x += b.vx * rest;
    b.z += b.vz * rest;
    b.y += b.vy * rest - (GRAVITY * rest * rest) / 2;
    b.vy -= GRAVITY * rest;
    emit(s, 'bounce', b.last, 'Bounce');
  }
  if (Math.abs(b.z) > 18 || Math.abs(b.x) > 12) {
    finishPoint(
      s,
      b.bounces ? b.last : opponent(b.last),
      b.bounces ? 'Winner' : 'Out'
    );
    return;
  }
  movePlayers(s, dt);
}
export function advance(s: MatchState, seconds: number) {
  let remaining = clamp(seconds, 0, 1);
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 120);
    stepMatch(s, dt);
    remaining -= dt;
  }
}
