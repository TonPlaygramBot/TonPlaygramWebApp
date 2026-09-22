// Shared by the live Pool and Snooker planners. Geometry and shot power stay
// with the table's physics adapter; selection must never resurrect a rejected
// route merely because no easy pot exists.
const PROFILES = Object.freeze({
  beginner: Object.freeze({ minPotChance: 0.58, cushionPenalty: 0.08, safetyWeight: 0.35, maxCandidates: 24 }),
  club: Object.freeze({ minPotChance: 0.48, cushionPenalty: 0.06, safetyWeight: 0.42, maxCandidates: 48 }),
  expert: Object.freeze({ minPotChance: 0.4, cushionPenalty: 0.04, safetyWeight: 0.5, maxCandidates: 72 }),
  champion: Object.freeze({ minPotChance: 0.36, cushionPenalty: 0.025, safetyWeight: 0.55, maxCandidates: 96 })
});

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function resolveBilliardsAiDifficulty(level = 'expert') {
  const aliases = { easy: 'beginner', medium: 'club', normal: 'club', hard: 'expert', pro: 'champion' };
  const key = String(level).toLowerCase();
  const name = PROFILES[key] ? key : aliases[key] ?? 'expert';
  return { name, ...PROFILES[name] };
}

function hasUsableShot(plan) {
  if (!plan || plan.targetBall?.active === false) return false;
  if (!Number.isFinite(plan.power) || plan.power <= 0 || plan.power > 1) return false;
  const direction = plan.aimDir;
  return Boolean(direction && Number.isFinite(direction.x) && Number.isFinite(direction.y) &&
    Math.hypot(direction.x, direction.y) > 1e-8);
}

/**
 * Inputs use the existing live engine's units, directions and normalized power.
 * Callbacks must validate geometry and legal first contact in the live snapshot.
 * Non-finite pot scores are hard rejections (blocked lane, scratch, illegal hit).
 * No low-confidence shot is forced when a verified safety is available.
 */
export function selectBilliardsAiPlans({
  scoredPots = [],
  safetyShots = [],
  difficulty = 'expert',
  isPlayablePlan,
  isFirstContactLegal
} = {}) {
  const profile = resolveBilliardsAiDifficulty(difficulty);
  if (typeof isPlayablePlan !== 'function' || typeof isFirstContactLegal !== 'function') {
    return { bestPot: null, bestSafety: null, reason: 'missing-live-validation' };
  }
  const valid = (plan) => hasUsableShot(plan) && isFirstContactLegal(plan) &&
    isPlayablePlan(plan, { allowCushion: true });

  const safeties = safetyShots.filter((plan) => plan?.type !== 'pot' && valid(plan))
    .slice().sort((a, b) => (Number.isFinite(b.quality) ? b.quality : 0) -
      (Number.isFinite(a.quality) ? a.quality : 0) ||
      (Number.isFinite(a.difficulty) ? a.difficulty : Infinity) -
      (Number.isFinite(b.difficulty) ? b.difficulty : Infinity));
  const bestSafety = safeties[0] ?? null;
  const safetyQuality = bestSafety && Number.isFinite(bestSafety.quality) ? clamp01(bestSafety.quality) : 0;
  const safetyValue = safetyQuality * profile.safetyWeight;

  const pots = scoredPots.filter((entry) => Number.isFinite(entry?.score) && entry?.plan?.type === 'pot')
    .slice().sort((a, b) => b.score - a.score).slice(0, profile.maxCandidates);
  let bestPot = null;
  let bestValue = -Infinity;
  for (const { plan, score } of pots) {
    if (!valid(plan)) continue;
    const confidence = Number.isFinite(plan.potChance) ? plan.potChance : plan.quality;
    if (!Number.isFinite(confidence)) continue;
    const chance = clamp01(confidence);
    if (chance < profile.minPotChance) continue;
    // Pocket likelihood matters more than a pleasing leave from a speculative
    // miss. A strong safety becomes attractive before a low-percentage attack.
    const value = chance * 0.72 + clamp01(score) * 0.28 - (1 - chance) * 0.18 -
      (plan.viaCushion ? profile.cushionPenalty : 0);
    if (value > bestValue) {
      bestPot = plan;
      bestValue = value;
    }
  }
  if (bestSafety && bestValue < safetyValue) bestPot = null;
  return {
    bestPot,
    bestSafety,
    reason: bestPot ? 'percentage-attack' : bestSafety ? 'verified-safety' : 'no-verified-route'
  };
}

function copyPlanningValue(value, key = '') {
  // The live object ball is an entity, not a copy of its pose. Keeping its
  // identity allows post-shot validation to observe it being pocketed.
  if (key === 'targetBall') return value;
  if (value == null || typeof value !== 'object') return value;
  if (typeof value.clone === 'function') return value.clone();
  if (Array.isArray(value)) return value.map((entry) => copyPlanningValue(entry));
  return Object.fromEntries(Object.entries(value).map(([field, entry]) => [field, copyPlanningValue(entry, field)]));
}

/**
 * Cache one exact stopped-table snapshot. Include variant, turn, ballOn,
 * freeBall/ballInHand, rule metadata, ball ids/active flags and unrounded x/y
 * positions in snapshot. Any change recomputes; no approximate key can retain
 * a now-blocked shot. Plans are copied on insertion AND delivery because the
 * live aiming/stroke code normalizes vectors and adjusts spin in place.
 */
export function createBilliardsPlanCache() {
  let previousKey;
  let previousValue;
  let populated = false;
  const cache = (snapshot, compute) => {
    let key;
    try {
      key = JSON.stringify(snapshot, (_field, value) => {
        if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
        return value;
      });
    } catch {
      // A cyclic/unsupported caller snapshot must not prevent taking a turn.
      return copyPlanningValue(compute());
    }
    if (!populated || key !== previousKey) {
      const nextValue = compute();
      previousValue = copyPlanningValue(nextValue);
      previousKey = key;
      populated = true;
    }
    return copyPlanningValue(previousValue);
  };
  cache.clear = () => {
    populated = false;
    previousKey = undefined;
    previousValue = undefined;
  };
  return cache;
}
