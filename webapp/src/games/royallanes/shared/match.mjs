import { newGame, pinsAvailable, recordRoll, totalScore } from './scoring.mjs';
import { ALL_PINS, APPROACH_MS, RESULT_MS, sanitizeShot } from './replay.mjs';
export const TURN_MS = 35_000;
export const MATCH_MS = 35 * 60_000;
export const RECONNECT_MS = 30_000;
export function createBowlingMatch(players) {
  if (players.length !== 2 || new Set(players.map((p) => p.id)).size !== 2)
    throw Error('two_players_required');
  return {
    players: players.map((p) => ({
      id: String(p.id),
      name: String(p.name || 'Bowler').slice(0, 24),
      score: newGame(),
      standing: [...ALL_PINS],
      misses: 0
    })),
    activeIndex: 0,
    turnId: 1,
    phase: 'waiting',
    roll: null,
    lastResult: null,
    winnerAccountId: '',
    reason: '',
    turnDeadline: 0,
    startsAt: 0,
    readyAt: 0
  };
}
export const activePlayer = (match) => match.players[match.activeIndex];
export function openTurn(match, now) {
  match.phase = 'aiming';
  match.turnDeadline = now + TURN_MS;
  match.roll = null;
}
export function beginShot(match, id, payload) {
  if (match.phase !== 'aiming') return { ok: false, error: 'roll_in_progress' };
  if (activePlayer(match).id !== id)
    return { ok: false, error: 'not_your_turn' };
  if (payload?.turnId !== match.turnId)
    return { ok: false, error: 'stale_turn' };
  const shot = sanitizeShot(payload?.shot);
  if (!shot) return { ok: false, error: 'invalid_shot' };
  match.phase = 'calculating';
  return {
    ok: true,
    shot,
    standing: [...activePlayer(match).standing],
    turnId: match.turnId
  };
}
export function startReplay(match, replay, now, { timedOut = false } = {}) {
  const p = activePlayer(match);
  match.roll = {
    id: match.turnId,
    actorId: p.id,
    startsAt: now + 250,
    releaseAt: now + 250 + APPROACH_MS,
    endsAt: now + 250 + APPROACH_MS + replay.durationMs,
    replay,
    timedOut
  };
  match.phase = 'rolling';
}
export function completeRoll(match, now) {
  const { replay, actorId, timedOut } = match.roll;
  const p = activePlayer(match);
  if (p.id !== actorId) throw Error('roll_owner_mismatch');
  const available = pinsAvailable(p.score),
    previousFrames = p.score.frames.length;
  p.score = recordRoll(p.score, replay.knocked);
  p.standing =
    pinsAvailable(p.score) === 10 ? [...ALL_PINS] : [...replay.standing];
  p.misses = timedOut ? p.misses + 1 : 0;
  match.lastResult = {
    actorId,
    knocked: replay.knocked,
    standing: [...replay.standing],
    gutter: replay.gutter,
    title:
      replay.knocked === 10
        ? 'Strike!'
        : replay.knocked === available
          ? 'Spare!'
          : replay.gutter
            ? 'Gutter ball'
            : `${replay.knocked} pins`,
    timedOut
  };
  match.nextIndex =
    p.score.finished || p.score.frames.length > previousFrames
      ? (match.activeIndex + 1) % 2
      : match.activeIndex;
  match.phase = 'result';
  match.readyAt = now + RESULT_MS;
  if (match.players.every((p) => p.score.finished)) {
    const [a, b] = match.players;
    const scoreA = totalScore(a.score),
      scoreB = totalScore(b.score);
    match.winnerAccountId =
      scoreA === scoreB ? '' : scoreA > scoreB ? a.id : b.id;
    match.reason = scoreA === scoreB ? 'tie_refund' : 'ten_frames_complete';
  }
}
export function nextTurn(match, now) {
  if (match.reason) {
    match.phase = 'finished';
    return false;
  }
  match.activeIndex = match.nextIndex ?? match.activeIndex;
  match.turnId++;
  openTurn(match, now);
  return true;
}
export function publicBowlingMatch(match) {
  return {
    players: match.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      total: totalScore(p.score),
      standing: p.standing
    })),
    activeId: activePlayer(match).id,
    turnId: match.turnId,
    phase: match.phase,
    roll: match.roll,
    lastResult: match.lastResult,
    winnerAccountId: match.winnerAccountId,
    reason: match.reason,
    turnDeadline: match.turnDeadline,
    startsAt: match.startsAt
  };
}
