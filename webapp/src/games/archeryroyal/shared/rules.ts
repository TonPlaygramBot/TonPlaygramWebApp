export const ENDS = 3;
export const ARROWS_PER_END = 3;
export const TOTAL_ARROWS = ENDS * ARROWS_PER_END * 2;

export type ArcheryPlayer = { id: string; name: string };
export type ShotIntent = { aimX: number; aimY: number; power: number };
export type Wind = { x: number; y: number };
export type ArrowResult = {
  playerId: string;
  turnId: number;
  x: number;
  y: number;
  score: number;
  bullseye: boolean;
  wind: Wind;
  power: number;
};
export type ArcheryMatch = {
  seed: number;
  players: ArcheryPlayer[];
  scores: Record<string, number>;
  arrows: Record<string, ArrowResult[]>;
  turnId: number;
  currentPlayerId: string;
  end: number;
  wind: Wind;
  phase: 'aiming' | 'finished';
  winnerId: string;
  reason: string;
};

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function noise(seed: number, index: number, channel = 0) {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(channel + 7, 0x85ebca6b)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

export function sanitizeShot(value: unknown): ShotIntent | null {
  const shot = value as Partial<ShotIntent> | null;
  if (!shot || !finite(shot.aimX) || !finite(shot.aimY) || !finite(shot.power)) return null;
  if (Math.abs(shot.aimX!) > 1 || Math.abs(shot.aimY!) > 1 || shot.power! < 0.35 || shot.power! > 1) return null;
  return { aimX: shot.aimX!, aimY: shot.aimY!, power: shot.power! };
}

export function windFor(seed: number, turnId: number): Wind {
  const strength = 0.8 + noise(seed, Math.floor(turnId / 2), 1) * 4.4;
  const angle = noise(seed, Math.floor(turnId / 2), 2) * Math.PI * 2;
  return {
    x: Math.round(Math.cos(angle) * strength * 10) / 10,
    y: Math.round(Math.sin(angle) * strength * 3) / 10
  };
}

export function ringScore(radius: number) {
  const rings = [0.08, 0.18, 0.32, 0.48, 0.66, 0.86, 1.08, 1.34, 1.62, 1.92];
  const index = rings.findIndex((limit) => radius <= limit);
  return index < 0 ? 0 : 10 - index;
}

export function resolveArrow(seed: number, turnId: number, input: ShotIntent): ArrowResult {
  const shot = sanitizeShot(input)!;
  const wind = windFor(seed, turnId);
  const x = shot.aimX * 0.92 + wind.x * (1.05 - shot.power) * 0.16 + (noise(seed, turnId, 8) - 0.5) * 0.025;
  const y = shot.aimY * 0.82 - (1 - shot.power) * 0.58 + wind.y * 0.035 + (noise(seed, turnId, 9) - 0.5) * 0.025;
  const score = ringScore(Math.hypot(x, y));
  return {
    playerId: '', turnId, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000,
    score, bullseye: score === 10 && Math.hypot(x, y) <= 0.045, wind, power: shot.power
  };
}

export function createMatch(players: ArcheryPlayer[], seed = Date.now() & 0x7fffffff): ArcheryMatch {
  if (players.length !== 2 || new Set(players.map((player) => player.id)).size !== 2) throw new Error('invalid_archery_roster');
  const clean = players.map((player) => ({ id: String(player.id), name: String(player.name || 'Archer').slice(0, 40) }));
  return {
    seed, players: clean, scores: Object.fromEntries(clean.map((player) => [player.id, 0])),
    arrows: Object.fromEntries(clean.map((player) => [player.id, []])), turnId: 1,
    currentPlayerId: clean[0].id, end: 1, wind: windFor(seed, 1), phase: 'aiming', winnerId: '', reason: ''
  };
}

export function submitShot(match: ArcheryMatch, playerId: string, raw: unknown) {
  if (match.phase !== 'aiming') return { ok: false as const, error: 'match_finished' };
  if (String(playerId) !== match.currentPlayerId) return { ok: false as const, error: 'not_your_turn' };
  const shot = sanitizeShot(raw);
  if (!shot) return { ok: false as const, error: 'invalid_shot' };
  const result = { ...resolveArrow(match.seed, match.turnId, shot), playerId: String(playerId) };
  match.arrows[playerId].push(result);
  match.scores[playerId] += result.score;
  match.turnId += 1;
  const shotsTaken = Object.values(match.arrows).reduce((sum, arrows) => sum + arrows.length, 0);
  if (shotsTaken >= TOTAL_ARROWS) {
    match.phase = 'finished';
    const [first, second] = match.players;
    match.winnerId = match.scores[first.id] === match.scores[second.id] ? 'draw' : match.scores[first.id] > match.scores[second.id] ? first.id : second.id;
    match.reason = match.winnerId === 'draw' ? 'score_draw' : 'score_complete';
  } else {
    match.currentPlayerId = match.players[(match.turnId - 1) % 2].id;
    match.end = Math.min(ENDS, Math.floor(shotsTaken / (ARROWS_PER_END * 2)) + 1);
    match.wind = windFor(match.seed, match.turnId);
  }
  return { ok: true as const, result, match };
}

export function chooseAiShot(match: ArcheryMatch, difficulty: 'club' | 'tour' | 'pro' = 'tour'): ShotIntent {
  const error = difficulty === 'pro' ? 0.055 : difficulty === 'club' ? 0.24 : 0.12;
  const power = difficulty === 'club' ? 0.77 : difficulty === 'pro' ? 0.9 : 0.84;
  const wind = match.wind;
  const aimX = -(wind.x * (1.05 - power) * 0.16) / 0.92 + (noise(match.seed, match.turnId, 20) - 0.5) * error * 2;
  const aimY = ((1 - power) * 0.58 - wind.y * 0.035) / 0.82 + (noise(match.seed, match.turnId, 21) - 0.5) * error * 2;
  return { aimX: clamp(aimX, -1, 1), aimY: clamp(aimY, -1, 1), power };
}

export function publicMatch(match: ArcheryMatch) {
  return JSON.parse(JSON.stringify(match)) as ArcheryMatch;
}
