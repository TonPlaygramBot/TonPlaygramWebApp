import { Vector2 } from 'three';
import { findBilliardsAiEscape } from './shared/billiardsAiEscape.js';

const VALUES = Object.freeze({ RED: 1, YELLOW: 2, GREEN: 3, BROWN: 4, BLUE: 5, PINK: 6, BLACK: 7 });
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const vec = p => new Vector2(p.x, p.y);

export function snookerAiColor(ball) {
  // Live Guret entities store a numeric material colour; their ID is the
  // rules identity. Rule snapshots may instead supply a semantic colour.
  const id = String(ball?.id ?? ball ?? '').toUpperCase();
  if (/^RED(?:_?\d+)?$/.test(id)) return 'RED';
  if (Object.hasOwn(VALUES, id)) return id;
  const color = typeof ball?.color === 'string' ? ball.color.toUpperCase() : null;
  return color && Object.hasOwn(VALUES, color) ? color : null;
}

export function snookerAiMatchesTarget(ball, target) {
  const color = snookerAiColor(ball);
  return color !== null && color === snookerAiColor(target);
}

/** Swept centre-to-centre clearance: two radii, not one ball's radius. */
export function snookerAiLaneClear(start, end, balls, radius, ignore = new Set()) {
  const delta = vec(end).sub(start), lenSq = delta.lengthSq();
  return balls.every(ball => {
    if (ball.active === false || ignore.has(ball.id)) return true;
    const t = lenSq > 1e-10 ? clamp(vec(ball.pos).sub(start).dot(delta) / lenSq) : 0;
    return vec(ball.pos).distanceToSquared(vec(start).addScaledVector(delta, t)) >= (radius * 2.015) ** 2;
  });
}

/** Ask the actual rules after the proposed pot; never assume another red or
 * reward a colour which has already left the table in the final clearance. */
export function snookerAiNextTargets({ rules, state, balls, cue, plan }) {
  if (typeof rules?.applyShot !== 'function') return null;
  const color = snookerAiColor(plan.targetBall);
  try {
    const next = rules.applyShot(state, [
      { type: 'HIT', firstContact: color, ballId: plan.targetBall.id },
      { type: 'POTTED', ball: color, ballId: plan.targetBall.id, pocket: plan.pocketId }
    ], { contactMade: true, cueBallPotted: false, nominatedBall: plan.nomination, simulated: true });
    if (!next || next.foul) return null;
    if (next.frameOver || (next.meta?.respottedBlack && !state.meta?.respottedBlack)) return [];
    if (next.activePlayer !== state.activePlayer) return null;
    return balls.filter(ball => ball.active !== false && ball !== cue && ball !== plan.targetBall &&
      (next.ballOn ?? []).some(target => snookerAiMatchesTarget(ball, target)));
  } catch {
    return null;
  }
}

function inBounds(point, config) {
  return Math.abs(point.x) <= config.limitX && Math.abs(point.y) <= config.limitY;
}

function clearContact(cue, direction, target, balls, trace) {
  const hit = trace(cue, direction, balls);
  return hit?.targetBall && String(hit.targetBall.id) === String(target.id) ? hit : null;
}

// This estimates position, not the full live spin solver. Keep side spin zero:
// unmodelled side-spin throw is particularly costly at snooker pocket mouths.
function estimateLeave(ghost, aim, normal, power, spin, config) {
  const tangent = aim.clone().addScaledVector(normal, -aim.dot(normal));
  const pace = config.radius * (4 + power * 22);
  const delta = tangent.multiplyScalar(pace).addScaledVector(aim, spin.y * pace * 1.6);
  return { end: ghost.clone().add(delta), distance: delta.length() };
}

function scratchOnSegment(start, end, pockets, radius) {
  const route = end.clone().sub(start), lenSq = route.lengthSq();
  return pockets.some(pocket => {
    const t = lenSq < 1e-10 ? 0 : clamp(vec(pocket).sub(start).dot(route) / lenSq);
    return vec(pocket).distanceToSquared(start.clone().addScaledVector(route, t)) < (pocket.radius ?? radius * 1.65) ** 2;
  });
}

/** A prospective next pot needs both a clear cue route and a clear object route. */
export function scoreSnookerAiPosition(cuePos, targets, balls, config) {
  if (!targets.length) return 1;
  let best = 0;
  for (const target of targets) for (let i = 0; i < config.pockets.length; i++) {
    const pocket = config.entranceForTarget?.(target.pos, i) ?? config.pockets[i];
    const objectDir = vec(pocket).sub(target.pos).normalize();
    const ghost = vec(target.pos).addScaledVector(objectDir, -config.radius * 2);
    const route = ghost.clone().sub(cuePos), distance = route.length();
    if (!inBounds(ghost, config) || distance < 1e-8) continue;
    const alignment = route.normalize().dot(objectDir);
    if (alignment < 0.24) continue;
    const ignore = new Set([config.cueId, target.id]);
    if (!snookerAiLaneClear(cuePos, ghost, balls, config.radius, ignore) ||
        !snookerAiLaneClear(target.pos, pocket, balls, config.radius, ignore)) continue;
    const ease = clamp(1 - (distance + vec(target.pos).distanceTo(pocket)) / (config.width + config.height));
    const value = (VALUES[snookerAiColor(target)] ?? 1) / 7;
    best = Math.max(best, alignment * 0.48 + ease * 0.38 + value * 0.14);
  }
  return best;
}

/** Bounded geometric planning, once per stopped-table snapshot. All contact
 * candidates are checked against the live table raycast before being returned.
 * Positional scores are estimates; the game still executes ordinary physics. */
export function selectSnookerAiPlans({ cue, balls = [], state, rules, radius,
  width, height, pockets = [], trace, powerFromDistance, entranceForTarget,
  limitX = width / 2 - radius, limitY = height / 2 - radius,
  baulkY = -height * 0.3, rating = 0.9 } = {}) {
  const empty = { bestPot: null, bestSafety: null, reason: 'no-verified-route' };
  if (!cue?.active || !cue.pos || !(radius > 0) || !(width > 0) || !(height > 0) ||
      typeof trace !== 'function' || typeof powerFromDistance !== 'function' || state?.frameOver) return empty;
  const active = balls.filter(ball => ball?.active !== false && Number.isFinite(ball.pos?.x) && Number.isFinite(ball.pos?.y));
  const legal = ball => (state?.ballOn ?? []).some(target => snookerAiMatchesTarget(ball, target));
  const targets = active.filter(ball => ball !== cue && legal(ball));
  const potTargets = state?.freeBall
    ? active.filter(ball => ball !== cue && snookerAiColor(ball)) : targets;
  if (!potTargets.length) return empty;
  const config = { radius, width, height, pockets, entranceForTarget, limitX, limitY, cueId: cue.id };
  const cuePos = vec(cue.pos), candidates = [];
  for (const targetBall of potTargets) for (let index = 0; index < pockets.length; index++) {
    const pocket = entranceForTarget?.(targetBall.pos, index) ?? pockets[index];
    const pocketCenter = vec(pocket), normal = pocketCenter.clone().sub(targetBall.pos);
    const objectDistance = normal.length();
    if (objectDistance <= radius) continue;
    normal.normalize();
    const ghost = vec(targetBall.pos).addScaledVector(normal, -radius * 2);
    const aimDir = ghost.clone().sub(cuePos), cueDistance = aimDir.length();
    if (!inBounds(ghost, config) || cueDistance < radius * 0.05) continue;
    aimDir.normalize();
    const cosine = aimDir.dot(normal);
    // A contact from the far side cannot pot in this pocket. abs(cos) accepts
    // those impossible back-cuts and used to rank them as straight shots.
    if (cosine < 0.22) continue;
    const ignore = new Set([cue.id, targetBall.id]);
    if (!snookerAiLaneClear(cuePos, ghost, active, radius, ignore) ||
        !snookerAiLaneClear(targetBall.pos, pocketCenter, active, radius, ignore)) continue;
    const contact = clearContact(cue, aimDir, targetBall, active, trace);
    if (!contact || (Number.isFinite(contact.tHit) && Math.abs(contact.tHit - cueDistance) > radius * 0.2)) continue;
    const power = clamp(powerFromDistance(cueDistance + objectDistance / Math.max(cosine * cosine, 0.1)), 0.25, 0.9);
    if (!Number.isFinite(power)) continue;
    const distancePenalty = clamp((cueDistance + objectDistance) / Math.max(width, height));
    const pocketOutward = pocketCenter.clone().normalize();
    const mouthAlignment = Math.max(0, normal.dot(pocketOutward));
    const chance = clamp(0.99 - (1 - cosine) * 0.48 - distancePenalty * 0.20 - (1 - mouthAlignment) * 0.19);
    candidates.push({ type: 'pot', aimDir, target: snookerAiColor(targetBall), targetBall,
      pocketCenter, pocketId: pockets[index].id ?? ['TL', 'TR', 'BL', 'BR', 'TM', 'BM'][index],
      pocketIndex: index, power, cueToTarget: cueDistance, targetToPocket: objectDistance,
      quality: chance, potChance: chance, difficulty: cueDistance + objectDistance / cosine,
      viaCushion: false, ghost, normal,
      nomination: state?.freeBall && !legal(targetBall) ? snookerAiColor(targetBall) : undefined });
  }
  candidates.sort((a, b) => b.potChance - a.potChance || a.difficulty - b.difficulty);
  let bestPot = null, attackValue = -Infinity;
  // Cap expensive next-position scans, independent of display frame rate.
  for (const candidate of candidates.slice(0, 18)) {
    const next = snookerAiNextTargets({ rules, state, balls: active, cue, plan: candidate });
    if (!Array.isArray(next)) continue;
    const remaining = active.filter(ball => ball !== cue && ball !== candidate.targetBall);
    let bestLeave = null;
    for (const y of [0, -0.22, 0.22]) {
      const spin = { x: 0, y };
      const leave = estimateLeave(candidate.ghost, candidate.aimDir, candidate.normal, candidate.power, spin, config);
      if (!inBounds(leave.end, config) || scratchOnSegment(candidate.ghost, leave.end, pockets, radius) ||
          !snookerAiLaneClear(candidate.ghost, leave.end, remaining, radius)) continue;
      const nextShotScore = scoreSnookerAiPosition(leave.end, next, remaining, config);
      const value = nextShotScore - Math.abs(y) * 0.04;
      if (!bestLeave || value > bestLeave.value) bestLeave = { value, spin, nextShotScore, cueAfter: leave.end };
    }
    if (!bestLeave) continue;
    const value = candidate.potChance * 0.72 + bestLeave.nextShotScore * 0.18 +
      ((candidate.nomination ? VALUES[state.ballOn?.[0]] ?? 1 : VALUES[candidate.target]) / 7) * candidate.potChance * 0.10;
    if (value > attackValue) {
      attackValue = value;
      bestPot = { ...candidate, spin: bestLeave.spin, cueAfter: bestLeave.cueAfter,
        nextShotScore: bestLeave.nextShotScore,
        aiMeta: { source: 'snooker-percentage-position', nextBallIds: next.map(ball => ball.id), estimatedLeave: true } };
    }
  }

  let bestSafety = null;
  const safeties = [];
  for (const targetBall of targets) {
    const direct = vec(targetBall.pos).sub(cuePos).normalize();
    // Thin contacts preserve cue-ball travel towards baulk; dead-centre contact
    // alone is not a safety. Consider both sides and reject blocked first hits.
    for (const cut of [-0.78, -0.48, 0, 0.48, 0.78]) {
      const normal = direct.clone().rotateAround(new Vector2(), cut);
      const ghost = vec(targetBall.pos).addScaledVector(normal, -radius * 2);
      const direction = ghost.clone().sub(cuePos), distance = direction.length();
      if (distance < 1e-8 || !inBounds(ghost, config)) continue;
      direction.normalize();
      const cosine = direction.dot(normal);
      if (cosine <= 0.2 || !snookerAiLaneClear(cuePos, ghost, active, radius, new Set([cue.id, targetBall.id])) ||
          !clearContact(cue, direction, targetBall, active, trace)) continue;
      for (const y of [-0.3, 0]) {
        const power = clamp(powerFromDistance(distance + radius * 8) * 0.78, 0.25, 0.65);
        if (!Number.isFinite(power)) continue;
        const spin = { x: 0, y };
        const leave = estimateLeave(ghost, direction, normal, power, spin, config);
        if (!inBounds(leave.end, config) || scratchOnSegment(ghost, leave.end, pockets, radius)) continue;
        const movedTarget = { ...targetBall, pos: vec(targetBall.pos).addScaledVector(normal, radius * (3 + power * 10) * cosine) };
        if (!inBounds(movedTarget.pos, config)) continue;
        const remaining = active.filter(ball => ball !== cue && ball !== targetBall);
        if (!snookerAiLaneClear(ghost, leave.end, remaining, radius)) continue;
        const opponentBalls = [...remaining, movedTarget];
        // After a miss on a nominated colour while reds remain, opponent is on red.
        const opponentTargets = state.phase === 'COLORS_ORDER'
          ? opponentBalls.filter(legal)
          : opponentBalls.filter(ball => snookerAiColor(ball) === 'RED');
        const effectiveTargets = opponentTargets.length ? opponentTargets : opponentBalls.filter(legal);
        const exposure = scoreSnookerAiPosition(leave.end, effectiveTargets, opponentBalls, config);
        const separation = effectiveTargets.length ? Math.min(...effectiveTargets.map(ball => vec(ball.pos).distanceTo(leave.end))) : 0;
        const baulk = clamp(1 - Math.abs(leave.end.y - baulkY) / height);
        const quality = clamp((1 - exposure) * 0.65 + clamp(separation / (height * 0.65)) * 0.23 + baulk * 0.12);
        safeties.push({ type: 'safety', aimDir: direction, power, spin, target: snookerAiColor(targetBall), targetBall,
          pocketId: 'SAFETY', cueToTarget: distance, difficulty: distance, quality, cueAfter: leave.end,
          aiMeta: { source: 'snooker-safety', opponentPotScore: exposure, estimatedLeave: true } });
      }
    }
  }
  safeties.sort((a, b) => b.quality - a.quality || a.power - b.power);
  bestSafety = safeties[0] ?? findBilliardsAiEscape({ cue, balls: active, legal, trace, radius, limitX, limitY, powerFromDistance });
  if (bestSafety) bestSafety = { ...bestSafety, target: snookerAiColor(bestSafety.targetBall) };
  const minimumChance = rating < 0.65 ? 0.68 : 0.59;
  if (bestPot && (bestPot.potChance < minimumChance ||
      (bestSafety?.quality > 0.65 && bestPot.potChance < 0.76 && attackValue < bestSafety.quality))) bestPot = null;
  return { bestPot, bestSafety, reason: bestPot ? 'percentage-attack' : bestSafety ? 'verified-safety' : 'no-verified-route' };
}
