const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const hash = (id) => [...String(id)].reduce((value, char) =>
  (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 0);
const unarmed = (actor) => !actor.weapon || actor.weapon === 'punch';
const canDefend = (n) => n?.kind === 'civilian' && n.health >= 40 &&
  n.role !== 'child' && n.motion !== 'cycle' && n.motion !== 'drive' &&
  !n.carId && !n.aircraftId && !n.custody && unarmed(n);
const eligibleAttacker = (actor) => actor && !actor.kind &&
  actor.id != null && String(actor.id).length > 0 && actor.health > 0 &&
  !actor.finished && !actor.failed && !actor.carId && !actor.aircraftId && unarmed(actor);

function cancelDefense(n) {
  n.defenseAttackerId = null;
  n.defenseUntil = 0;
  n.nextCounterAt = 0;
}

/** Called only after actual damage. Most civilians still flee; a stable subset
 * will briefly defend themselves from a nearby, unarmed player who hit them. */
export function registerPedestrianDefense(n, attacker, amount, time) {
  if (!canDefend(n) || !eligibleAttacker(attacker) || !Number.isFinite(time) ||
      !Number.isFinite(amount) || amount <= 0 || amount > 35 ||
      !(distance(n, attacker) <= 2.2) || hash(n.id) % 4 !== 0) return false;

  const continuing = n.defenseAttackerId === attacker.id && n.defenseUntil > time;
  n.defenseAttackerId = attacker.id;
  n.defenseUntil = time + 4;
  // Further hits cannot postpone an existing windup or bypass strike cadence.
  if (!continuing) {n.defenseStartedAt=time;n.nextCounterAt = Math.max(time + 0.3, n.nextCounterAt || 0);}
  return true;
}

/** Returns a bounded melee intent; the shared simulation applies any damage.
 * Drawing a weapon or withdrawing ends this response permanently. Occlusion
 * pauses it so punches cannot connect through a wall. */
export function pedestrianDefenseIntent(n, state, clear) {
  if (state.paused) return null;
  if (n.defenseAttackerId == null) return null;
  const time = state.elapsed;
  const target = state.players && Object.hasOwn(state.players, n.defenseAttackerId)
    ? state.players[n.defenseAttackerId] : null;
  if (!canDefend(n) || !Number.isFinite(time) || !(time < n.defenseUntil) ||
      !eligibleAttacker(target) || target.id !== n.defenseAttackerId ||
      !(distance(n, target) <= 2.4)) {
    cancelDefense(n);
    return null;
  }
  if (typeof clear !== 'function' || !clear(n, target)) return null;
  const strike = time >= n.nextCounterAt;
  if (strike) {
    n.punchedAt = time;
    n.nextCounterAt = time + 0.9;
  }
  return { target, strike };
}
