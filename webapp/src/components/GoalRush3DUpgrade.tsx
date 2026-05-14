import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type Team = 'blue' | 'red';
type MatchPhase = 'kickoff' | 'playing' | 'goal' | 'finished';
type Vec = { x: number; y: number };
type PlayerState = {
  team: Team;
  name: string;
  pos: Vec;
  vel: Vec;
  dir: Vec;
  radius: number;
  speed: number;
  sprint: number;
  tackle: number;
  kick: number;
  stun: number;
  scoreFlash: number;
};
type BallState = {
  pos: Vec;
  vel: Vec;
  radius: number;
  spin: number;
  lastTouch: Team | null;
};
type Particle = {
  pos: Vec;
  vel: Vec;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};
type FloatingText = { text: string; pos: Vec; life: number; color: string };
type InputState = {
  move: Vec;
  kick: boolean;
  sprint: boolean;
  tackle: boolean;
};
type GameState = {
  blue: PlayerState;
  red: PlayerState;
  ball: BallState;
  score: Record<Team, number>;
  target: number;
  timer: number;
  phase: MatchPhase;
  phaseTime: number;
  kickoffTeam: Team;
  message: string;
  particles: Particle[];
  floating: FloatingText[];
  combo: number;
  shake: number;
  aiEnabled: boolean;
};

type Snapshot = {
  score: Record<Team, number>;
  target: number;
  timer: number;
  phase: MatchPhase;
  message: string;
  blueSprint: number;
  redSprint: number;
  combo: number;
  aiEnabled: boolean;
};

const WORLD = Object.freeze({ width: 720, height: 1120 });
const PITCH = Object.freeze({ left: 54, right: 666, top: 138, bottom: 982 });
const CENTER = Object.freeze({ x: WORLD.width / 2, y: WORLD.height / 2 });
const GOAL = Object.freeze({ width: 224, depth: 50 });
const GOAL_LEFT = CENTER.x - GOAL.width / 2;
const GOAL_RIGHT = CENTER.x + GOAL.width / 2;
const PLAYER_RADIUS = 33;
const BALL_RADIUS = 18;
const MATCH_SECONDS = 150;
const FIXED_STEP = 1 / 60;
const MAX_DT = 1 / 24;
const EPS = 0.0001;
const COLORS = Object.freeze({
  blue: '#31a8ff',
  red: '#ff4b65',
  grassA: '#123a2a',
  grassB: '#0d2f23',
  line: 'rgba(224,255,239,0.82)',
  gold: '#ffd166'
});

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const len = (v: Vec) => Math.hypot(v.x, v.y);
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (v: Vec, s: number): Vec => ({ x: v.x * s, y: v.y * s });
const norm = (v: Vec): Vec => {
  const m = len(v);
  return m > EPS ? { x: v.x / m, y: v.y / m } : { x: 0, y: -1 };
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const teamColor = (team: Team) => (team === 'blue' ? COLORS.blue : COLORS.red);
const enemyGoalY = (team: Team) => (team === 'blue' ? PITCH.top - GOAL.depth : PITCH.bottom + GOAL.depth);
const ownGoalY = (team: Team) => (team === 'blue' ? PITCH.bottom + GOAL.depth : PITCH.top - GOAL.depth);

function parseTarget(search: string) {
  const params = new URLSearchParams(search);
  const parsed = Number(params.get('target') || params.get('goal'));
  return Number.isFinite(parsed) ? clamp(Math.round(parsed), 1, 9) : 3;
}

function parseAiEnabled(search: string) {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  const type = params.get('type');
  return mode !== 'local' && type !== 'training-2p';
}

function makePlayer(team: Team, name: string, x: number, y: number): PlayerState {
  return {
    team,
    name,
    pos: { x, y },
    vel: { x: 0, y: 0 },
    dir: { x: 0, y: team === 'blue' ? -1 : 1 },
    radius: PLAYER_RADIUS,
    speed: team === 'blue' ? 430 : 410,
    sprint: 1,
    tackle: 0,
    kick: 0,
    stun: 0,
    scoreFlash: 0
  };
}

function makeInitialState(target: number, aiEnabled: boolean): GameState {
  return {
    blue: makePlayer('blue', 'You', CENTER.x, PITCH.bottom - 160),
    red: makePlayer('red', aiEnabled ? 'RushBot' : 'Player 2', CENTER.x, PITCH.top + 160),
    ball: {
      pos: { ...CENTER },
      vel: { x: 0, y: 0 },
      radius: BALL_RADIUS,
      spin: 0,
      lastTouch: null
    },
    score: { blue: 0, red: 0 },
    target,
    timer: MATCH_SECONDS,
    phase: 'kickoff',
    phaseTime: 1.2,
    kickoffTeam: 'blue',
    message: 'Swipe, sprint, tackle — first touch starts Goal Rush.',
    particles: [],
    floating: [],
    combo: 0,
    shake: 0,
    aiEnabled
  };
}

function resetPositions(state: GameState, kickoffTeam: Team) {
  state.blue.pos = { x: CENTER.x, y: PITCH.bottom - 160 };
  state.red.pos = { x: CENTER.x, y: PITCH.top + 160 };
  state.blue.vel = { x: 0, y: 0 };
  state.red.vel = { x: 0, y: 0 };
  state.blue.dir = { x: 0, y: -1 };
  state.red.dir = { x: 0, y: 1 };
  state.ball.pos = { ...CENTER };
  state.ball.vel = { x: kickoffTeam === 'blue' ? -38 : 38, y: kickoffTeam === 'blue' ? -70 : 70 };
  state.ball.lastTouch = null;
  state.ball.spin = 0;
  state.kickoffTeam = kickoffTeam;
}

function addBurst(state: GameState, pos: Vec, color: string, count = 16, power = 220) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = power * (0.25 + Math.random() * 0.9);
    state.particles.push({
      pos: { ...pos },
      vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
      life: 0.45 + Math.random() * 0.45,
      maxLife: 0.9,
      color,
      size: 3 + Math.random() * 8
    });
  }
}

function addText(state: GameState, text: string, pos: Vec, color = COLORS.gold) {
  state.floating.push({ text, pos: { ...pos }, life: 1.25, color });
}

function safeGoalGapY(y: number) {
  return y < PITCH.top || y > PITCH.bottom;
}

function confinePlayer(player: PlayerState) {
  player.pos.x = clamp(player.pos.x, PITCH.left + player.radius, PITCH.right - player.radius);
  player.pos.y = clamp(player.pos.y, PITCH.top + player.radius, PITCH.bottom - player.radius);
}

function wallBounceBall(ball: BallState) {
  if (ball.pos.x - ball.radius < PITCH.left) {
    ball.pos.x = PITCH.left + ball.radius;
    ball.vel.x = Math.abs(ball.vel.x) * 0.78;
  } else if (ball.pos.x + ball.radius > PITCH.right) {
    ball.pos.x = PITCH.right - ball.radius;
    ball.vel.x = -Math.abs(ball.vel.x) * 0.78;
  }

  const inGoalMouth = ball.pos.x > GOAL_LEFT && ball.pos.x < GOAL_RIGHT;
  if (ball.pos.y - ball.radius < PITCH.top && !inGoalMouth) {
    ball.pos.y = PITCH.top + ball.radius;
    ball.vel.y = Math.abs(ball.vel.y) * 0.78;
  } else if (ball.pos.y + ball.radius > PITCH.bottom && !inGoalMouth) {
    ball.pos.y = PITCH.bottom - ball.radius;
    ball.vel.y = -Math.abs(ball.vel.y) * 0.78;
  }

  if (safeGoalGapY(ball.pos.y)) {
    if (ball.pos.x - ball.radius < GOAL_LEFT) {
      ball.pos.x = GOAL_LEFT + ball.radius;
      ball.vel.x = Math.abs(ball.vel.x) * 0.72;
    } else if (ball.pos.x + ball.radius > GOAL_RIGHT) {
      ball.pos.x = GOAL_RIGHT - ball.radius;
      ball.vel.x = -Math.abs(ball.vel.x) * 0.72;
    }
  }
}

function desiredAiMove(state: GameState): InputState {
  const { red, blue, ball } = state;
  const dBall = dist(red.pos, ball.pos);
  const ballToBlueGoal = Math.abs(ball.pos.y - PITCH.bottom);
  const redToGoal = Math.abs(red.pos.y - PITCH.top);
  const hasLane = Math.abs(red.pos.x - CENTER.x) < GOAL.width * 0.48;
  let target: Vec;

  if (ball.lastTouch === 'red' && dBall < 150) {
    target = { x: clamp(ball.pos.x, GOAL_LEFT + 24, GOAL_RIGHT - 24), y: ball.pos.y + 54 };
  } else if (ball.pos.y < CENTER.y + 80 || dBall < 230) {
    const lead = clamp(len(ball.vel) / 9, 0, 70);
    target = { x: ball.pos.x + ball.vel.x * 0.08, y: ball.pos.y + lead * 0.15 };
  } else if (ballToBlueGoal < 260 && redToGoal > 210) {
    target = { x: mix(red.pos.x, CENTER.x, 0.08), y: PITCH.top + 190 };
  } else {
    target = { x: clamp(ball.pos.x, PITCH.left + 86, PITCH.right - 86), y: CENTER.y - 170 };
  }

  const move = norm(sub(target, red.pos));
  const shouldKick = dBall < KICK_TOUCH_RANGE && (ball.pos.y > red.pos.y || hasLane);
  return {
    move,
    kick: shouldKick,
    sprint: dBall > 160 || ball.pos.y > CENTER.y,
    tackle: dBall < 118 && ball.lastTouch === 'blue' && blue.pos.y < red.pos.y + 170
  };
}

const KICK_TOUCH_RANGE = PLAYER_RADIUS + BALL_RADIUS + 18;

function updatePlayer(player: PlayerState, input: InputState, dt: number) {
  player.kick = Math.max(0, player.kick - dt);
  player.tackle = Math.max(0, player.tackle - dt);
  player.stun = Math.max(0, player.stun - dt);
  player.scoreFlash = Math.max(0, player.scoreFlash - dt);

  const inputMag = clamp(len(input.move), 0, 1);
  const wanted = inputMag > 0.04 ? norm(input.move) : { x: 0, y: 0 };
  if (inputMag > 0.04) player.dir = norm(add(mul(player.dir, 0.84), mul(wanted, 0.16)));

  const sprinting = input.sprint && player.sprint > 0.06 && inputMag > 0.05;
  const speed = player.speed * (sprinting ? 1.34 : 1) * (player.stun > 0 ? 0.35 : 1);
  const acceleration = speed * 6.2;
  player.vel.x += wanted.x * acceleration * dt;
  player.vel.y += wanted.y * acceleration * dt;

  const maxSpeed = speed * (player.tackle > 0.12 ? 1.35 : 1);
  const currentSpeed = len(player.vel);
  if (currentSpeed > maxSpeed) player.vel = mul(norm(player.vel), maxSpeed);

  if (input.tackle && player.tackle <= 0 && player.stun <= 0) {
    player.tackle = 0.38;
    player.vel.x += player.dir.x * 360;
    player.vel.y += player.dir.y * 360;
  }

  if (input.kick && player.kick <= 0 && player.stun <= 0) player.kick = 0.2;

  player.pos.x += player.vel.x * dt;
  player.pos.y += player.vel.y * dt;
  player.vel.x *= Math.pow(0.045, dt);
  player.vel.y *= Math.pow(0.045, dt);
  player.sprint = clamp(player.sprint + (sprinting ? -0.46 : 0.25) * dt, 0, 1);
  confinePlayer(player);
}

function collidePlayers(a: PlayerState, b: PlayerState) {
  const delta = sub(a.pos, b.pos);
  const d = Math.max(len(delta), EPS);
  const overlap = a.radius + b.radius - d;
  if (overlap <= 0) return;
  const n = mul(delta, 1 / d);
  a.pos = add(a.pos, mul(n, overlap * 0.5));
  b.pos = add(b.pos, mul(n, -overlap * 0.5));
  const shove = 45 + (a.tackle > 0.1 || b.tackle > 0.1 ? 135 : 0);
  a.vel = add(a.vel, mul(n, shove));
  b.vel = add(b.vel, mul(n, -shove));
  if (a.tackle > 0.16) b.stun = Math.max(b.stun, 0.22);
  if (b.tackle > 0.16) a.stun = Math.max(a.stun, 0.22);
  confinePlayer(a);
  confinePlayer(b);
}

function collideBallWithPlayer(state: GameState, player: PlayerState) {
  const { ball } = state;
  const delta = sub(ball.pos, player.pos);
  const d = Math.max(len(delta), EPS);
  const overlap = player.radius + ball.radius - d;
  const near = d < KICK_TOUCH_RANGE;
  if (overlap > 0) {
    const n = mul(delta, 1 / d);
    ball.pos = add(ball.pos, mul(n, overlap + 0.4));
    const intoBall = Math.max(0, dot(player.vel, n));
    ball.vel = add(ball.vel, mul(n, 150 + intoBall * 0.72));
    ball.vel = add(ball.vel, mul(player.dir, 55));
    ball.lastTouch = player.team;
    state.combo += 1;
  }

  const kickActive = player.kick > 0.08;
  if (near && kickActive) {
    const towardGoal = norm({ x: CENTER.x - ball.pos.x, y: enemyGoalY(player.team) - ball.pos.y });
    const aim = norm(add(mul(player.dir, 0.74), mul(towardGoal, 0.42)));
    const bonus = player.tackle > 0.08 ? 150 : 0;
    const power = 690 + len(player.vel) * 0.36 + bonus;
    ball.vel = add(mul(aim, power), mul(player.vel, 0.16));
    ball.spin += (player.team === 'blue' ? 1 : -1) * (0.7 + Math.random() * 0.4);
    ball.lastTouch = player.team;
    player.kick = 0;
    state.shake = Math.max(state.shake, 8);
    state.combo += 2;
    addBurst(state, ball.pos, teamColor(player.team), 8, 130);
  }
}

function resolveGoal(state: GameState, scorer: Team) {
  const ownGoal = state.ball.lastTouch && state.ball.lastTouch !== scorer;
  state.score[scorer] += 1;
  state.phase = state.score[scorer] >= state.target ? 'finished' : 'goal';
  state.phaseTime = state.phase === 'finished' ? 99 : 1.45;
  state.message = state.phase === 'finished'
    ? `${scorer === 'blue' ? 'Blue' : 'Red'} wins the Goal Rush!`
    : ownGoal
      ? `Own goal chaos — ${scorer === 'blue' ? 'Blue' : 'Red'} scores!`
      : `${scorer === 'blue' ? 'Blue' : 'Red'} scores!`;
  state[scorer].scoreFlash = 0.8;
  state.combo = 0;
  state.shake = 18;
  addBurst(state, { x: CENTER.x, y: scorer === 'blue' ? PITCH.top - 32 : PITCH.bottom + 32 }, teamColor(scorer), 42, 420);
  addText(state, 'GOAL!', { x: CENTER.x, y: CENTER.y - 74 }, teamColor(scorer));
  if (state.phase === 'goal') resetPositions(state, scorer === 'blue' ? 'red' : 'blue');
}

function updateBall(state: GameState, dt: number) {
  const { ball } = state;
  ball.vel.x += ball.spin * 18 * dt;
  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;
  ball.vel.x *= Math.pow(0.16, dt);
  ball.vel.y *= Math.pow(0.16, dt);
  ball.spin *= Math.pow(0.2, dt);
  wallBounceBall(ball);

  if (ball.pos.y + ball.radius < PITCH.top - GOAL.depth && ball.pos.x > GOAL_LEFT && ball.pos.x < GOAL_RIGHT) {
    resolveGoal(state, 'blue');
  } else if (ball.pos.y - ball.radius > PITCH.bottom + GOAL.depth && ball.pos.x > GOAL_LEFT && ball.pos.x < GOAL_RIGHT) {
    resolveGoal(state, 'red');
  }
}

function updateEffects(state: GameState, dt: number) {
  state.particles = state.particles
    .map((p) => ({
      ...p,
      life: p.life - dt,
      pos: add(p.pos, mul(p.vel, dt)),
      vel: mul(p.vel, Math.pow(0.05, dt))
    }))
    .filter((p) => p.life > 0)
    .slice(-110);
  state.floating = state.floating
    .map((f) => ({ ...f, life: f.life - dt, pos: { x: f.pos.x, y: f.pos.y - 55 * dt } }))
    .filter((f) => f.life > 0)
    .slice(-6);
  state.shake = Math.max(0, state.shake - 36 * dt);
}

function stepGame(state: GameState, blueInput: InputState, redInput: InputState, dt: number) {
  updateEffects(state, dt);
  if (state.phase === 'finished') return;

  state.phaseTime -= dt;
  if (state.phase === 'kickoff' && state.phaseTime <= 0) {
    state.phase = 'playing';
    state.message = 'Attack the open goal. Dash tackles can steal momentum.';
  }
  if (state.phase === 'goal' && state.phaseTime <= 0) {
    state.phase = 'kickoff';
    state.phaseTime = 0.85;
    state.message = `${state.kickoffTeam === 'blue' ? 'Blue' : 'Red'} kickoff.`;
  }
  if (state.phase !== 'playing') return;

  state.timer = Math.max(0, state.timer - dt);
  if (state.timer <= 0) {
    state.phase = 'finished';
    const winner = state.score.blue === state.score.red ? 'Draw' : state.score.blue > state.score.red ? 'Blue wins' : 'Red wins';
    state.message = `${winner} at full time!`;
    return;
  }

  const aiInput = state.aiEnabled ? desiredAiMove(state) : redInput;
  updatePlayer(state.blue, blueInput, dt);
  updatePlayer(state.red, aiInput, dt);
  collidePlayers(state.blue, state.red);
  collideBallWithPlayer(state, state.blue);
  collideBallWithPlayer(state, state.red);
  updateBall(state, dt);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawPitch(ctx: CanvasRenderingContext2D, time: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  grad.addColorStop(0, '#06151c');
  grad.addColorStop(0.45, '#08251c');
  grad.addColorStop(1, '#101122');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.save();
  ctx.shadowColor = 'rgba(49,168,255,0.45)';
  ctx.shadowBlur = 35;
  roundedRect(ctx, PITCH.left - 20, PITCH.top - 20, PITCH.right - PITCH.left + 40, PITCH.bottom - PITCH.top + 40, 44);
  ctx.fillStyle = '#07180f';
  ctx.fill();
  ctx.restore();

  roundedRect(ctx, PITCH.left, PITCH.top, PITCH.right - PITCH.left, PITCH.bottom - PITCH.top, 34);
  ctx.clip();
  for (let i = 0; i < 12; i += 1) {
    ctx.fillStyle = i % 2 ? COLORS.grassA : COLORS.grassB;
    const y = PITCH.top + (i * (PITCH.bottom - PITCH.top)) / 12;
    ctx.fillRect(PITCH.left, y, PITCH.right - PITCH.left, (PITCH.bottom - PITCH.top) / 12 + 1);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = PITCH.left + 38; x < PITCH.right; x += 38) {
    ctx.beginPath();
    ctx.moveTo(x, PITCH.top);
    ctx.lineTo(x + Math.sin(time * 0.8 + x) * 7, PITCH.bottom);
    ctx.stroke();
  }

  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 4;
  roundedRect(ctx, PITCH.left + 8, PITCH.top + 8, PITCH.right - PITCH.left - 16, PITCH.bottom - PITCH.top - 16, 28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(PITCH.left + 12, CENTER.y);
  ctx.lineTo(PITCH.right - 12, CENTER.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CENTER.x, CENTER.y, 96, 0, Math.PI * 2);
  ctx.stroke();

  const drawBox = (top: boolean) => {
    const y = top ? PITCH.top + 8 : PITCH.bottom - 146;
    roundedRect(ctx, CENTER.x - 164, y, 328, 138, 18);
    ctx.stroke();
    roundedRect(ctx, CENTER.x - 76, top ? PITCH.top + 8 : PITCH.bottom - 72, 152, 64, 14);
    ctx.stroke();
  };
  drawBox(true);
  drawBox(false);
  ctx.restore();

  const glow = (color: string, y: number) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;
    roundedRect(ctx, GOAL_LEFT, y, GOAL.width, GOAL.depth, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
  };
  glow(COLORS.blue, PITCH.top - GOAL.depth);
  glow(COLORS.red, PITCH.bottom);

  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  for (let i = 0; i < 20; i += 1) {
    const x = 16 + (i % 10) * 76;
    const y = i < 10 ? 82 : 1038;
    ctx.beginPath();
    ctx.arc(x, y + Math.sin(time * 2 + i) * 4, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: PlayerState) {
  const color = teamColor(p.team);
  const sprintGlow = p.sprint < 0.35 ? 0.3 : 1;
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);
  ctx.rotate(Math.atan2(p.dir.y, p.dir.x) + Math.PI / 2);
  ctx.shadowColor = color;
  ctx.shadowBlur = 18 + p.scoreFlash * 22;
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath();
  ctx.ellipse(0, 14, p.radius * 1.05, p.radius * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createLinearGradient(-p.radius, -p.radius, p.radius, p.radius);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.2, color);
  body.addColorStop(1, p.team === 'blue' ? '#0646a5' : '#9f1239');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.86)';
  ctx.stroke();

  ctx.fillStyle = 'rgba(4,10,20,0.75)';
  roundedRect(ctx, -14, -p.radius - 11, 28, 20, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.team === 'blue' ? '1' : '2', 0, -p.radius - 1);

  ctx.fillStyle = `rgba(255,255,255,${0.12 + sprintGlow * 0.18})`;
  ctx.beginPath();
  ctx.moveTo(0, -p.radius - 18);
  ctx.lineTo(-10, -p.radius + 3);
  ctx.lineTo(10, -p.radius + 3);
  ctx.closePath();
  ctx.fill();

  if (p.tackle > 0.1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.globalAlpha = p.tackle / 0.38;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 11, -Math.PI * 0.15, Math.PI * 1.15);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(2,8,23,0.78)';
  roundedRect(ctx, p.pos.x - 48, p.pos.y + p.radius + 13, 96, 9, 5);
  ctx.fill();
  ctx.fillStyle = color;
  roundedRect(ctx, p.pos.x - 48, p.pos.y + p.radius + 13, 96 * p.sprint, 9, 5);
  ctx.fill();
}

function drawBall(ctx: CanvasRenderingContext2D, ball: BallState) {
  ctx.save();
  ctx.translate(ball.pos.x, ball.pos.y);
  ctx.rotate(ball.spin);
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(6, 10, ball.radius * 1.15, ball.radius * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(-7, -9, 4, 0, 0, ball.radius + 6);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#f8fafc');
  g.addColorStop(1, '#a3a3a3');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius * (0.2 + i * 0.15), i, i + Math.PI * 0.72);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEffects(ctx: CanvasRenderingContext2D, state: GameState) {
  state.particles.forEach((p) => {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.size * ctx.globalAlpha, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  state.floating.forEach((f) => {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 18;
    ctx.font = '900 56px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.pos.x, f.pos.y);
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function renderGame(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawPitch(ctx, time);

  const speed = len(state.ball.vel);
  if (speed > 90) {
    const dir = norm(state.ball.vel);
    const trail = ctx.createLinearGradient(
      state.ball.pos.x,
      state.ball.pos.y,
      state.ball.pos.x - dir.x * clamp(speed * 0.16, 20, 120),
      state.ball.pos.y - dir.y * clamp(speed * 0.16, 20, 120)
    );
    trail.addColorStop(0, 'rgba(255,255,255,0.48)');
    trail.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = trail;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(state.ball.pos.x, state.ball.pos.y);
    ctx.lineTo(state.ball.pos.x - dir.x * clamp(speed * 0.16, 20, 120), state.ball.pos.y - dir.y * clamp(speed * 0.16, 20, 120));
    ctx.stroke();
  }

  const first = state.blue.pos.y < state.red.pos.y ? [state.blue, state.red] : [state.red, state.blue];
  drawPlayer(ctx, first[0]);
  drawPlayer(ctx, first[1]);
  drawBall(ctx, state.ball);
  drawEffects(ctx, state);

  if (state.phase !== 'playing') {
    ctx.fillStyle = 'rgba(2,6,23,0.52)';
    roundedRect(ctx, 96, CENTER.y - 98, WORLD.width - 192, 150, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '900 34px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.phase === 'finished' ? 'FULL TIME' : state.phase === 'goal' ? 'GOAL RUSH!' : 'KICKOFF', CENTER.x, CENTER.y - 43);
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = '700 20px Inter, system-ui, sans-serif';
    ctx.fillText(state.message, CENTER.x, CENTER.y + 3, WORLD.width - 230);
  }

  ctx.restore();
}

function emptyInput(): InputState {
  return { move: { x: 0, y: 0 }, kick: false, sprint: false, tackle: false };
}

function snapshotFromState(state: GameState): Snapshot {
  return {
    score: { ...state.score },
    target: state.target,
    timer: state.timer,
    phase: state.phase,
    message: state.message,
    blueSprint: state.blue.sprint,
    redSprint: state.red.sprint,
    combo: state.combo,
    aiEnabled: state.aiEnabled
  };
}

function formatClock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function GoalRush3DUpgrade() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<GameState>(makeInitialState(parseTarget(search), parseAiEnabled(search)));
  const accumulatorRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const keysRef = useRef(new Set<string>());
  const pointerRef = useRef<{ id: number; start: Vec; current: Vec } | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => snapshotFromState(stateRef.current));
  const [touchAim, setTouchAim] = useState<Vec>({ x: 0, y: 0 });
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);

  const target = useMemo(() => parseTarget(search), [search]);
  const aiEnabled = useMemo(() => parseAiEnabled(search), [search]);

  const rebuild = useCallback(() => {
    stateRef.current = makeInitialState(target, aiEnabled);
    accumulatorRef.current = 0;
    setSnapshot(snapshotFromState(stateRef.current));
  }, [aiEnabled, target]);

  useEffect(() => {
    rebuild();
  }, [rebuild]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      keysRef.current.add(event.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.code === 'KeyP') setPaused((value) => !value);
    };
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const readInputs = useCallback((): { blue: InputState; red: InputState } => {
    const keys = keysRef.current;
    const blue = emptyInput();
    if (keys.has('KeyA')) blue.move.x -= 1;
    if (keys.has('KeyD')) blue.move.x += 1;
    if (keys.has('KeyW')) blue.move.y -= 1;
    if (keys.has('KeyS')) blue.move.y += 1;
    blue.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    blue.kick = keys.has('Space') || keys.has('KeyF');
    blue.tackle = keys.has('KeyE') || keys.has('KeyQ');

    if (pointerRef.current) {
      const p = pointerRef.current;
      const move = { x: (p.current.x - p.start.x) / 64, y: (p.current.y - p.start.y) / 64 };
      const mag = len(move);
      if (mag > 0.08) blue.move = mul(norm(move), clamp(mag, 0, 1));
      blue.sprint = mag > 0.82;
    }

    const red = emptyInput();
    if (keys.has('ArrowLeft')) red.move.x -= 1;
    if (keys.has('ArrowRight')) red.move.x += 1;
    if (keys.has('ArrowUp')) red.move.y -= 1;
    if (keys.has('ArrowDown')) red.move.y += 1;
    red.sprint = keys.has('Numpad0') || keys.has('Slash');
    red.kick = keys.has('Enter') || keys.has('NumpadEnter');
    red.tackle = keys.has('Period') || keys.has('NumpadDecimal');
    return { blue, red };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const resize = () => {
      const parent = wrapRef.current;
      const rect = parent?.getBoundingClientRect();
      const cssW = Math.max(320, rect?.width || window.innerWidth);
      const cssH = Math.max(560, rect?.height || window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = (now: number) => {
      const t = now / 1000;
      const last = lastTimeRef.current || t;
      const dt = Math.min(MAX_DT, t - last);
      lastTimeRef.current = t;
      const state = stateRef.current;
      if (!paused) {
        accumulatorRef.current += dt;
        while (accumulatorRef.current >= FIXED_STEP) {
          const inputs = readInputs();
          stepGame(state, inputs.blue, inputs.red, FIXED_STEP);
          accumulatorRef.current -= FIXED_STEP;
        }
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / dpr / WORLD.width, canvas.height / dpr / WORLD.height);
      const ox = (canvas.width / dpr - WORLD.width * scale) / 2;
      const oy = (canvas.height / dpr - WORLD.height * scale) / 2;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
      renderGame(ctx, state, t);

      if (Math.floor(now / 120) !== Math.floor((now - dt * 1000) / 120)) {
        setSnapshot(snapshotFromState(state));
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [paused, readInputs]);

  const pointerToLocal = useCallback((event: React.PointerEvent): Vec => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const point = pointerToLocal(event);
    pointerRef.current = { id: event.pointerId, start: point, current: point };
    setTouchAim({ x: 0, y: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [pointerToLocal]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    pointer.current = pointerToLocal(event);
    const aim = sub(pointer.current, pointer.start);
    const mag = Math.min(74, len(aim));
    setTouchAim(mul(norm(aim), mag));
  }, [pointerToLocal]);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const flick = sub(pointer.current, pointer.start);
    const state = stateRef.current;
    if (len(flick) < 18) {
      state.blue.kick = Math.max(state.blue.kick, 0.22);
    } else if (len(flick) > 86) {
      state.blue.tackle = Math.max(state.blue.tackle, 0.36);
    }
    pointerRef.current = null;
    setTouchAim({ x: 0, y: 0 });
  }, []);

  const triggerKick = useCallback(() => {
    stateRef.current.blue.kick = Math.max(stateRef.current.blue.kick, 0.22);
  }, []);

  const triggerTackle = useCallback(() => {
    const blue = stateRef.current.blue;
    if (blue.tackle <= 0) blue.tackle = 0.38;
  }, []);

  const toggleAi = useCallback(() => {
    const state = stateRef.current;
    state.aiEnabled = !state.aiEnabled;
    state.red.name = state.aiEnabled ? 'RushBot' : 'Player 2';
    setSnapshot(snapshotFromState(state));
  }, []);

  return (
    <div
      ref={wrapRef}
      className="goal-rush-rebuild"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas ref={canvasRef} aria-label="Goal Rush 1v1 mini football arena" />

      <div className="goal-rush-hud goal-rush-scoreboard">
        <div className="team blue"><span>BLUE</span><strong>{snapshot.score.blue}</strong></div>
        <div className="clock"><span>FIRST TO {snapshot.target}</span><strong>{formatClock(snapshot.timer)}</strong></div>
        <div className="team red"><span>{snapshot.aiEnabled ? 'BOT' : 'RED'}</span><strong>{snapshot.score.red}</strong></div>
      </div>

      <div className="goal-rush-hud goal-rush-status">
        <strong>{snapshot.phase === 'playing' ? 'LIVE 1v1 MINI FOOTBALL' : snapshot.phase.toUpperCase()}</strong>
        <span>{snapshot.message}</span>
        {snapshot.combo > 4 && <em>touch chain x{snapshot.combo}</em>}
      </div>

      <div className="goal-rush-hud goal-rush-actions" onPointerDown={(event) => event.stopPropagation()}>
        <button onClick={triggerKick}>Kick</button>
        <button onClick={triggerTackle}>Dash tackle</button>
      </div>

      <div className="goal-rush-hud goal-rush-menu" onPointerDown={(event) => event.stopPropagation()}>
        <button onClick={() => setPaused((value) => !value)}>{paused ? 'Resume' : 'Pause'}</button>
        <button onClick={rebuild}>Rematch</button>
        <button onClick={toggleAi}>{snapshot.aiEnabled ? '2P local' : 'Bot match'}</button>
        <button onClick={() => setMuted((value) => !value)}>{muted ? 'Sound on' : 'Mute'}</button>
        <button onClick={() => navigate('/games/goalrush/lobby')}>Lobby</button>
      </div>

      <div className="goal-rush-hud goal-rush-help">
        <b>Controls</b>
        <span>WASD move • Shift sprint • Space/F kick • Q/E tackle</span>
        <span>Local red: arrows • Enter kick • / tackle</span>
        <span>Touch: drag joystick, tap kick, long flick tackle</span>
      </div>

      <div className="goal-rush-stick" aria-hidden="true">
        <i style={{ transform: `translate(${touchAim.x}px, ${touchAim.y}px)` }} />
      </div>

      <style>{`
        .goal-rush-rebuild {
          position: fixed;
          inset: 0;
          overflow: hidden;
          touch-action: none;
          user-select: none;
          background: #030712;
          color: white;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .goal-rush-rebuild canvas { display: block; width: 100%; height: 100%; }
        .goal-rush-hud {
          position: absolute;
          z-index: 2;
          border: 1px solid rgba(255,255,255,0.16);
          background: linear-gradient(135deg, rgba(2,6,23,0.78), rgba(15,23,42,0.48));
          box-shadow: 0 18px 60px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08);
          backdrop-filter: blur(16px);
        }
        .goal-rush-scoreboard {
          left: max(12px, env(safe-area-inset-left));
          right: max(12px, env(safe-area-inset-right));
          top: max(12px, env(safe-area-inset-top));
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 24px;
        }
        .goal-rush-scoreboard .team,
        .goal-rush-scoreboard .clock {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 46px;
          border-radius: 18px;
          background: rgba(255,255,255,0.07);
        }
        .goal-rush-scoreboard span { font-size: 10px; letter-spacing: 0.22em; opacity: 0.76; font-weight: 900; }
        .goal-rush-scoreboard strong { font-size: clamp(24px, 7vw, 42px); line-height: 1; }
        .goal-rush-scoreboard .blue strong { color: ${COLORS.blue}; text-shadow: 0 0 22px rgba(49,168,255,0.8); }
        .goal-rush-scoreboard .red strong { color: ${COLORS.red}; text-shadow: 0 0 22px rgba(255,75,101,0.8); }
        .goal-rush-scoreboard .clock { flex-direction: column; gap: 2px; padding: 0 18px; }
        .goal-rush-scoreboard .clock strong { font-size: clamp(18px, 4vw, 28px); }
        .goal-rush-status {
          left: 50%;
          top: max(96px, calc(env(safe-area-inset-top) + 94px));
          transform: translateX(-50%);
          width: min(560px, calc(100vw - 28px));
          border-radius: 20px;
          padding: 12px 16px;
          text-align: center;
        }
        .goal-rush-status strong { display: block; color: ${COLORS.gold}; font-size: 12px; letter-spacing: 0.18em; }
        .goal-rush-status span { display: block; margin-top: 4px; color: rgba(255,255,255,0.84); font-weight: 700; font-size: 13px; }
        .goal-rush-status em { display: inline-block; margin-top: 7px; color: #86efac; font-style: normal; font-weight: 900; }
        .goal-rush-actions {
          right: max(14px, env(safe-area-inset-right));
          bottom: max(24px, env(safe-area-inset-bottom));
          display: grid;
          gap: 10px;
          padding: 10px;
          border-radius: 24px;
        }
        .goal-rush-actions button,
        .goal-rush-menu button {
          appearance: none;
          border: 0;
          border-radius: 18px;
          color: white;
          font-weight: 900;
          cursor: pointer;
          background: linear-gradient(135deg, rgba(49,168,255,0.9), rgba(124,58,237,0.9));
          box-shadow: 0 10px 24px rgba(0,0,0,0.22);
        }
        .goal-rush-actions button { width: 116px; min-height: 58px; font-size: 14px; }
        .goal-rush-actions button:nth-child(2) { background: linear-gradient(135deg, rgba(255,75,101,0.94), rgba(249,115,22,0.9)); }
        .goal-rush-menu {
          left: max(14px, env(safe-area-inset-left));
          bottom: max(24px, env(safe-area-inset-bottom));
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          width: min(330px, calc(100vw - 164px));
          padding: 10px;
          border-radius: 22px;
        }
        .goal-rush-menu button { min-height: 36px; padding: 0 12px; font-size: 12px; background: rgba(255,255,255,0.12); }
        .goal-rush-help {
          left: max(14px, env(safe-area-inset-left));
          top: 50%;
          width: 230px;
          transform: translateY(-50%);
          border-radius: 20px;
          padding: 12px;
          display: grid;
          gap: 5px;
          color: rgba(255,255,255,0.72);
          font-size: 11px;
        }
        .goal-rush-help b { color: white; letter-spacing: 0.14em; font-size: 11px; text-transform: uppercase; }
        .goal-rush-stick {
          position: absolute;
          left: max(26px, env(safe-area-inset-left));
          bottom: max(126px, calc(env(safe-area-inset-bottom) + 126px));
          width: 132px;
          height: 132px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.14);
          background: radial-gradient(circle, rgba(255,255,255,0.12), rgba(255,255,255,0.03));
          pointer-events: none;
        }
        .goal-rush-stick i {
          position: absolute;
          left: 41px;
          top: 41px;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${COLORS.blue}, #fff);
          box-shadow: 0 0 24px rgba(49,168,255,0.65);
        }
        @media (max-width: 720px) {
          .goal-rush-help { display: none; }
          .goal-rush-status { top: max(88px, calc(env(safe-area-inset-top) + 86px)); }
          .goal-rush-scoreboard { grid-template-columns: 1fr 0.8fr 1fr; }
          .goal-rush-scoreboard .team { flex-direction: column; gap: 1px; }
          .goal-rush-scoreboard span { font-size: 8px; }
          .goal-rush-menu { width: min(210px, calc(100vw - 162px)); }
          .goal-rush-actions button { width: 104px; min-height: 54px; }
        }
      `}</style>
    </div>
  );
}
