import { randomInt } from 'node:crypto';

export const SPIN_SEGMENTS = [400, 600, 800, 1000, 1200, 1400, 1600, 'FREE_SPIN', 'BONUS_X3', 'BOMB', 'BOMB'];
export const NUMERIC_SEGMENTS = SPIN_SEGMENTS.filter((value) => typeof value === 'number');
const COOLDOWNS = { spin: 3600000, roulette: 14400000, lucky: 14400000 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (code, status = 409) => Object.assign(new Error(code), { code, status });
export function validateKind(kind) {
  if (typeof kind !== 'string' || !Object.hasOwn(COOLDOWNS, kind)) throw fail('invalid_reward_kind', 400);
  return kind;
}
function validateId(id) {
  if (typeof id !== 'string' || !UUID.test(id)) throw fail('invalid_reward_id', 400);
  return id.toLowerCase();
}
export function selectReward(kind, random = randomInt) {
  if (kind === 'lucky') {
    const dice = [random(6) + 1, random(6) + 1];
    const cardIndex = dice[0] + dice[1] - 2;
    const suitIndex = random(4);
    const suit = ['hearts', 'spades', 'diamonds', 'clubs'][suitIndex];
    const chance = random(100);
    const baseOutcome = chance < 15 ? 'BONUS_X3' : chance < 30 ? 'FREE_SPIN' : NUMERIC_SEGMENTS[random(NUMERIC_SEGMENTS.length)];
    const bonusOutcomes = baseOutcome === 'BONUS_X3' ? Array.from({ length: 3 }, () => NUMERIC_SEGMENTS[random(NUMERIC_SEGMENTS.length)]) : [];
    const outcome = typeof baseOutcome === 'number' ? Math.floor(baseOutcome * [2, 0.5, 1.5, 0.75][suitIndex]) : baseOutcome;
    const amount = typeof outcome === 'number' ? outcome : bonusOutcomes.reduce((sum, value) => sum + value, 0);
    return { dice, cardIndex, suit, baseOutcome, outcome, amount, bonusOutcomes };
  }
  if (kind === 'roulette') {
    const outcome = random(37);
    return { outcome, amount: outcome === 0 ? 5000 : outcome * 100, bonusOutcomes: [] };
  }
  const outcome = SPIN_SEGMENTS[random(SPIN_SEGMENTS.length)];
  const bonusOutcomes = outcome === 'BONUS_X3' ? Array.from({ length: 3 }, () => NUMERIC_SEGMENTS[random(NUMERIC_SEGMENTS.length)]) : [];
  const amount = typeof outcome === 'number' ? outcome : bonusOutcomes.reduce((sum, value) => sum + value, 0);
  return { outcome, amount, bonusOutcomes };
}
function stateFor(user, kind) { return user?.spinRewards?.[kind] || {}; }
function serialize(state, kind, pending = state.pending) {
  return {
    ...pending, kind,
    readyAt: new Date(pending.readyAt).getTime(),
    nextSpinAt: state.nextSpinAt ? new Date(state.nextSpinAt).getTime() : 0,
    freeSpins: state.freeSpins || 0
  };
}
function transactionId(user, kind, id) { return `reward:${String(user._id)}:${kind}:${id}`; }
function receipt(user, kind, id) {
  const tx = user.transactions?.find((entry) => entry.transactionId === transactionId(user, kind, id));
  if (!tx?.detail) return null;
  try {
    const state = stateFor(user, kind);
    return { ...JSON.parse(tx.detail), claimed: true, balance: user.balance,
      nextSpinAt: state.nextSpinAt ? new Date(state.nextSpinAt).getTime() : 0,
      freeSpins: state.freeSpins || 0, spinFreeSpins: stateFor(user, 'spin').freeSpins || 0 };
  } catch { return null; }
}

/** Single-document compare-and-update: no transaction or process-local lock required.
 * Balance, ledger receipt, claim state and bonus spins commit in one Mongo write.
 */
export function createSpinRewards({ User, clock = Date.now, random = randomInt }) {
  const read = async (userId) => {
    const user = await User.findOne({ _id: userId, isBanned: { $ne: true } }).lean();
    if (!user) throw fail('account_not_found', 404);
    if (!Array.isArray(user.transactions) || !Number.isFinite(user.balance)) throw fail('account_requires_repair');
    return user;
  };
  return {
    async status(userId, kind) {
      validateKind(kind);
      const user = await read(userId);
      const state = stateFor(user, kind);
      return { pending: state.pending && !state.pending.claimed ? serialize(state, kind) : null,
        nextSpinAt: state.nextSpinAt ? new Date(state.nextSpinAt).getTime() : 0,
        freeSpins: state.freeSpins || 0, spinFreeSpins: stateFor(user, 'spin').freeSpins || 0 };
    },
    async start(userId, kind, requestId) {
      validateKind(kind);
      const id = validateId(requestId);
      // Retry on a competing start/claim, not on a changing random result.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const user = await read(userId);
        const oldReceipt = receipt(user, kind, id);
        if (oldReceipt) return oldReceipt;
        const state = stateFor(user, kind);
        if (state.pending && !state.pending.claimed) return serialize(state, kind);
        const now = clock();
        const useFreeSpin = kind === 'spin' && Number.isSafeInteger(state.freeSpins) && state.freeSpins > 0;
        if (!useFreeSpin && new Date(state.nextSpinAt || 0).getTime() > now) throw fail('reward_cooldown');
        const prefix = `spinRewards.${kind}`;
        const pending = { id, ...selectReward(kind, random), readyAt: new Date(now + (useFreeSpin ? 0 : 15000)), claimed: false };
        const nextSpinAt = useFreeSpin ? new Date(state.nextSpinAt || 0) : new Date(now + COOLDOWNS[kind] + (kind === 'lucky' ? 15000 : 0));
        const filter = { _id: user._id, isBanned: { $ne: true }, [`${prefix}.pending.id`]: state.pending?.id || { $exists: false } };
        if (state.pending) filter[`${prefix}.pending.claimed`] = true;
        if (useFreeSpin) filter[`${prefix}.freeSpins`] = state.freeSpins;
        else filter.$or = [{ [`${prefix}.nextSpinAt`]: { $exists: false } }, { [`${prefix}.nextSpinAt`]: { $lte: new Date(now) } }];
        const update = { $set: { [`${prefix}.pending`]: pending, [`${prefix}.nextSpinAt`]: nextSpinAt } };
        if (useFreeSpin) update.$inc = { [`${prefix}.freeSpins`]: -1 };
        const updated = await User.findOneAndUpdate(filter, update, { new: true }).lean();
        if (updated) return serialize(stateFor(updated, kind), kind);
      }
      throw fail('reward_busy_retry');
    },
    async claim(userId, kind, requestId) {
      validateKind(kind);
      const id = validateId(requestId);
      const user = await read(userId);
      const oldReceipt = receipt(user, kind, id);
      if (oldReceipt) return oldReceipt;
      const state = stateFor(user, kind);
      if (!state.pending || state.pending.id !== id) throw fail('reward_not_found', 404);
      if (new Date(state.pending.readyAt).getTime() > clock()) throw fail('reward_not_ready');
      const prefix = `spinRewards.${kind}`;
      const grant = serialize(state, kind);
      const freeSpinsAwarded = state.pending.outcome === 'FREE_SPIN' ? 2 : 0;
      const freeSpinPrefix = kind === 'lucky' ? 'spinRewards.spin' : prefix;
      const nextSpinAt = kind === 'lucky' ? clock() + COOLDOWNS.lucky : grant.nextSpinAt;
      const result = { ...grant, nextSpinAt, claimed: true, freeSpins: grant.freeSpins + (kind === 'lucky' ? 0 : freeSpinsAwarded),
        freeSpinsAwarded, spinFreeSpins: (stateFor(user, 'spin').freeSpins || 0) + freeSpinsAwarded };
      const txId = transactionId(user, kind, id);
      const update = {
        $inc: { balance: state.pending.amount, ...(freeSpinsAwarded ? { [`${freeSpinPrefix}.freeSpins`]: freeSpinsAwarded } : {}) },
        $set: { [`${prefix}.pending.claimed`]: true, ...(kind === 'lucky' ? { [`${prefix}.nextSpinAt`]: new Date(nextSpinAt) } : {}) },
        $push: { transactions: { transactionId: txId, amount: state.pending.amount, type: kind, status: 'delivered', date: new Date(clock()), detail: JSON.stringify(result) } }
      };
      const updated = await User.findOneAndUpdate({
        _id: user._id, isBanned: { $ne: true }, balance: { $type: 'number' }, transactions: { $type: 'array' },
        [`${prefix}.pending.id`]: id, [`${prefix}.pending.claimed`]: false,
        [`${prefix}.pending.readyAt`]: { $lte: new Date(clock()) },
        'transactions.transactionId': { $ne: txId }
      }, update, { new: true }).lean();
      if (updated) return { ...result, balance: updated.balance, freeSpins: stateFor(updated, kind).freeSpins || 0, spinFreeSpins: stateFor(updated, 'spin').freeSpins || 0 };
      // A concurrent successful claimant (or response retry) gets the same receipt.
      const settled = receipt(await read(userId), kind, id);
      if (settled) return settled;
      throw fail('reward_changed_retry');
    }
  };
}
