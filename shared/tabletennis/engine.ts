/** Deterministic singles table tennis. Metres, seconds; 240 Hz collision steps. */
export type Seat = 0 | 1;
export type Shot = 'drive' | 'topspin' | 'backspin' | 'smash';
export type Input = {
  moveX: number | null;
  aim: number;
  power: number;
  shot: Shot;
  swing: number;
  assist: boolean;
  autoHit: boolean;
};
export type MatchConfig = {
  ai: boolean;
  difficulty: number;
  gamesToWin: number;
  seed: number;
  upgrades: number[];
};
export type Score = {
  points: number[];
  games: number[];
  history: number[][];
  server: Seat;
  firstServer: Seat;
  totalPoints: number;
};
export type MatchState = {
  config: MatchConfig;
  phase: 'serve' | 'toss' | 'rally' | 'point' | 'over';
  time: number;
  remainder: number;
  phaseAt: number;
  players: {
    x: number;
    z: number;
    swingAt: number;
    swingId: number;
    queued: number;
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
  rally: number;
  bestRally: number;
  rng: number;
  aiAim: number;
  aiError: number;
  pointCount: number;
};
export const HALF_WIDTH = 0.7625,
  HALF_LENGTH = 1.37,
  TABLE_HEIGHT = 0.76,
  NET_HEIGHT = 0.1525,
  BALL_RADIUS = 0.02,
  GRAVITY = 9.81;
export const side = (s: Seat) => (s === 0 ? 1 : -1);
export const opponent = (s: Seat): Seat => (s === 0 ? 1 : 0);
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export const neutralInput = (): Input => ({
  moveX: null,
  aim: 0,
  power: 0.5,
  shot: 'drive',
  swing: 0,
  assist: true,
  autoHit: true
});
export const initialScore = (): Score => ({
  points: [0, 0],
  games: [0, 0],
  history: [],
  server: 0,
  firstServer: 0,
  totalPoints: 0
});
export function awardPoint(s: Score, winner: Seat, gamesToWin = 2): boolean {
  s.points[winner]++;
  s.totalPoints++;
  const p = s.points;
  if (p[winner] >= 11 && p[winner] - p[1 - winner] >= 2) {
    s.history.push([...p]);
    s.games[winner]++;
    if (s.games[winner] >= gamesToWin) return true;
    s.points = [0, 0];
    s.firstServer = opponent(s.firstServer);
    s.server = s.firstServer;
  } else {
    const n = p[0] + p[1];
    // Two serves each; one each from 10–10 onward.
    const turn = p[0] >= 10 && p[1] >= 10 ? n - 20 : Math.floor(n / 2);
    s.server = turn % 2 ? opponent(s.firstServer) : s.firstServer;
  }
  return false;
}
export function createMatch(config: Partial<MatchConfig> = {}): MatchState {
  const c = {
    ai: true,
    difficulty: 1,
    gamesToWin: 2,
    upgrades: [0, 0, 0],
    seed: 41237,
    ...config
  };
  c.gamesToWin = [1, 2, 3].includes(c.gamesToWin) ? c.gamesToWin : 2;
  c.difficulty = clamp(Math.floor(c.difficulty), 0, 2);
  const s: MatchState = {
    config: c,
    phase: 'serve',
    time: 0,
    remainder: 0,
    phaseAt: 0,
    players: [0, 1].map((i) => ({
      x: 0,
      z: i === 0 ? 1.62 : -1.62,
      swingAt: -10,
      swingId: 0,
      queued: -10,
      hitX: 0,
      hitY: 1.1,
      hitZ: 0
    })),
    ball: {
      x: 0,
      y: 1.04,
      z: 1.53,
      vx: 0,
      vy: 0,
      vz: 0,
      last: 0,
      bounces: 0,
      serve: true,
      serveStage: 0,
      netTouch: false,
      spin: 0
    },
    score: initialScore(),
    inputs: [neutralInput(), neutralInput()],
    events: [],
    eventId: 0,
    message: 'Your serve',
    winner: null,
    rally: 0,
    bestRally: 0,
    rng: c.seed >>> 0,
    aiAim: 0,
    aiError: 0,
    pointCount: 0
  };
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
export function setInput(s: MatchState, seat: Seat, p: Partial<Input>) {
  if (seat !== 0 && seat !== 1) return;
  const old = s.inputs[seat],
    finite = (v: unknown, f: number) =>
      typeof v === 'number' && Number.isFinite(v) ? v : f;
  const swing =
    Number.isSafeInteger(p.swing) && p.swing! >= old.swing
      ? p.swing!
      : old.swing;
  s.inputs[seat] = {
    moveX:
      p.moveX === null
        ? null
        : clamp(finite(p.moveX, old.moveX ?? 0), -1.12, 1.12),
    aim: clamp(finite(p.aim, old.aim), -1, 1),
    power: clamp(finite(p.power, old.power), 0, 1),
    shot: ['drive', 'topspin', 'backspin', 'smash'].includes(p.shot || '')
      ? p.shot!
      : old.shot,
    swing,
    assist: typeof p.assist === 'boolean' ? p.assist : old.assist,
    autoHit: typeof p.autoHit === 'boolean' ? p.autoHit : old.autoHit
  };
  if (swing > old.swing) s.players[seat].queued = s.time;
}
function point(s: MatchState, w: Seat, label: string) {
  if (s.phase === 'over' || s.phase === 'point') return;
  const over = awardPoint(s.score, w, s.config.gamesToWin);
  s.phase = over ? 'over' : 'point';
  s.phaseAt = s.time;
  s.message = label;
  s.pointCount++;
  s.winner = over ? w : null;
  s.ball.vx = s.ball.vy = s.ball.vz = 0;
  event(s, over ? 'win' : 'point', w, label);
}
function resetPoint(s: MatchState) {
  const seat = s.score.server,
    p = s.players[seat];
  s.phase = 'serve';
  s.phaseAt = s.time;
  s.rally = 0;
  s.message = seat === 0 ? 'Your serve' : 'Opponent serves';
  Object.assign(s.ball, {
    x: clamp(p.x, -0.55, 0.55),
    y: 1.04,
    z: side(seat) * 1.53,
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
  s.players.forEach((p) => (p.queued = -10));
}
function toss(s: MatchState) {
  s.phase = 'toss';
  s.phaseAt = s.time;
  s.ball.vy = 2.15; // 23.6 cm vertical toss, no spin.
  event(s, 'serve', s.score.server, 'Serve');
}
function serve(s: MatchState) {
  const seat = s.score.server,
    b = s.ball,
    i = s.inputs[seat],
    t = 0.32;
  b.vx = (i.aim * 0.4 - b.x) / 0.8;
  b.vz = -side(seat) * 3.0;
  b.vy = (TABLE_HEIGHT + BALL_RADIUS - b.y + 0.5 * GRAVITY * t * t) / t;
  b.spin = 0;
  b.last = seat;
  s.phase = 'rally';
  s.phaseAt = s.time;
  s.message = 'Serve';
  Object.assign(s.players[seat], {
    swingAt: s.time,
    queued: -10,
    hitX: b.x,
    hitY: b.y,
    hitZ: b.z
  });
  event(s, 'hit', seat, 'Serve');
}
function shot(s: MatchState, seat: Seat) {
  const b = s.ball,
    i = s.inputs[seat];
  if (b.serve && b.serveStage !== 2) return;
  if (b.bounces !== 1 || b.last === seat) return;
  const miss = seat === 1 && s.config.ai ? s.aiError : 0;
  const depth = i.shot === 'backspin' ? 0.55 : 1.03;
  const targetX = i.aim * (0.53 + (i.shot === 'smash' ? 0.08 : 0)) + miss;
  const power = clamp(
    i.power + (seat === 0 ? (s.config.upgrades[1] || 0) * 0.06 : 0),
    0,
    1
  );
  const t =
    i.shot === 'smash'
      ? 0.44
      : i.shot === 'backspin'
        ? 0.68
        : 0.6 - power * 0.075;
  const spin = i.shot === 'topspin' ? 1 : i.shot === 'backspin' ? -1 : 0;
  const gravity = GRAVITY + spin * 2;
  b.vx = (targetX - b.x) / t;
  b.vz = (-side(seat) * depth - b.z) / t;
  b.vy = (TABLE_HEIGHT + BALL_RADIUS - b.y + 0.5 * gravity * t * t) / t;
  b.last = seat;
  b.bounces = 0;
  b.serve = false;
  b.spin = spin;
  b.netTouch = false;
  Object.assign(s.players[seat], {
    swingAt: s.time,
    queued: -10,
    hitX: b.x,
    hitY: b.y,
    hitZ: b.z
  });
  s.rally++;
  s.bestRally = Math.max(s.rally, s.bestRally);
  s.message = 'Rally';
  s.aiAim = (rand(s) * 2 - 1) * 0.95;
  s.aiError = (rand(s) * 2 - 1) * [0.24, 0.11, 0.04][s.config.difficulty];
  if (rand(s) < [0.12, 0.06, 0.022][s.config.difficulty])
    s.aiError = (rand(s) > 0.5 ? 1 : -1) * 1.25;
  event(s, 'hit', seat, i.shot);
}
function physics(s: MatchState, dt: number) {
  const b = s.ball,
    prev = { x: b.x, y: b.y, z: b.z };
  b.vy -= (GRAVITY + b.spin * 2) * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  // Swept net test prevents fast shots passing through between frames.
  if (prev.z * b.z < 0) {
    const t = prev.z / (prev.z - b.z),
      y = prev.y + (b.y - prev.y) * t,
      x = prev.x + (b.x - prev.x) * t;
    if (
      Math.abs(x) <= HALF_WIDTH + 0.1525 &&
      y - BALL_RADIUS <= TABLE_HEIGHT + NET_HEIGHT
    ) {
      if (b.serve && y > TABLE_HEIGHT + NET_HEIGHT - 0.07) {
        b.netTouch = true;
        b.vz *= 0.86;
        b.vy = Math.max(b.vy, 0.8);
      } else {
        point(s, opponent(b.last), 'Into the net');
        return;
      }
    }
  }
  if (
    prev.y > TABLE_HEIGHT + BALL_RADIUS &&
    b.y <= TABLE_HEIGHT + BALL_RADIUS &&
    b.vy < 0
  ) {
    const t = (prev.y - TABLE_HEIGHT - BALL_RADIUS) / (prev.y - b.y),
      x = prev.x + (b.x - prev.x) * t,
      z = prev.z + (b.z - prev.z) * t;
    if (Math.abs(x) <= HALF_WIDTH && Math.abs(z) <= HALF_LENGTH) {
      const landed: Seat = z >= 0 ? 0 : 1;
      if (b.serve) {
        const expected = b.serveStage === 0 ? b.last : opponent(b.last);
        if (landed !== expected) {
          point(s, opponent(b.last), 'Service fault');
          return;
        }
        b.serveStage++;
        if (b.serveStage === 2 && b.netTouch) {
          s.phase = 'point';
          s.phaseAt = s.time;
          s.message = 'Let · serve again';
          event(s, 'let', b.last, s.message);
          return;
        }
        if (b.serveStage > 2) {
          point(s, b.last, 'Second bounce');
          return;
        }
        b.bounces = b.serveStage === 2 ? 1 : 0;
      } else {
        if (landed === b.last) {
          point(s, opponent(b.last), 'Wrong side of the table');
          return;
        }
        b.bounces++;
        if (b.bounces > 1) {
          point(s, b.last, 'Second bounce');
          return;
        }
      }
      b.y = TABLE_HEIGHT + BALL_RADIUS + 0.001;
      b.vy = -b.vy * (b.serve ? 0.91 : 0.83);
      b.vz *= 1 + b.spin * 0.06;
      event(s, 'bounce', landed, 'Table bounce');
    }
  }
  if (b.y < 0.1 || Math.abs(b.z) > 3.2 || Math.abs(b.x) > 2.6) {
    point(
      s,
      b.bounces === 1 ? b.last : opponent(b.last),
      b.bounces === 1 ? 'Unreturned' : 'Out'
    );
  }
}
function step(s: MatchState, dt: number) {
  s.time += dt;
  if (s.phase === 'over') return;
  if (s.phase === 'point') {
    if (s.time - s.phaseAt > 1.1) resetPoint(s);
    return;
  }
  const b = s.ball;
  for (let n = 0; n < 2; n++) {
    const seat = n as Seat,
      p = s.players[n],
      input = s.inputs[n],
      ai = n === 1 && s.config.ai;
    if (ai) {
      input.aim = s.aiAim;
      input.power = [0.25, 0.5, 0.85][s.config.difficulty];
      input.shot =
        s.config.difficulty === 2 && s.rally % 3 === 0
          ? 'smash'
          : s.rally % 4 === 0
            ? 'topspin'
            : 'drive';
    }
    const incoming = b.last !== n && s.phase === 'rally';
    let target = input.moveX ?? p.x;
    if (ai || input.assist)
      target = incoming
        ? b.x + b.vx * Math.max(0, (side(seat) * 1.12 - b.z) / (b.vz || 1))
        : clamp(p.x, -0.4, 0.4);
    const speed = ai
      ? [2.2, 3.1, 4][s.config.difficulty]
      : 2.05 + (s.config.upgrades[0] || 0) * 0.22;
    p.x += clamp(target - p.x, -speed * dt, speed * dt);
    p.x = clamp(p.x, -1.12, 1.12);
    const queued = s.time - p.queued < 0.85;
    if (
      incoming &&
      b.bounces === 1 &&
      Math.abs(b.z) > 1.08 &&
      Math.abs(b.z) < 2.15 &&
      b.y > 0.8 &&
      b.y < 1.8 &&
      Math.abs(p.x - b.x) <
        0.34 + (seat === 0 ? (s.config.upgrades[2] || 0) * 0.025 : 0) &&
      (ai || input.autoHit || queued)
    )
      shot(s, seat);
    else if (
      incoming &&
      queued &&
      !input.autoHit &&
      b.bounces === 0 &&
      Math.abs(b.z) > 1.2 &&
      Math.abs(p.x - b.x) < 0.22
    ) {
      point(s, opponent(seat), 'Volley · let the ball bounce');
      return;
    }
  }
  if (s.phase === 'serve') {
    b.x = clamp(s.players[s.score.server].x, -0.55, 0.55);
    if (
      (s.score.server === 1 && s.config.ai && s.time - s.phaseAt > 0.8) ||
      s.time - s.players[s.score.server].queued < 0.85
    )
      toss(s);
    else if (s.time - s.phaseAt > 20)
      point(s, opponent(s.score.server), 'Serve clock expired');
    return;
  }
  if (s.phase === 'toss') {
    b.vy -= GRAVITY * dt;
    b.y += b.vy * dt;
    if (b.vy < 0 && b.y <= 1.2) serve(s);
    return;
  }
  physics(s, dt);
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
