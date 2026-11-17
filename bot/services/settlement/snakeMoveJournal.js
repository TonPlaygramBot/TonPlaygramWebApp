import { randomInt } from 'node:crypto';
import { verifySocialCredentials } from '../../middleware/socialAuth.js';
import { applySnakeJournalRoll, journalHash, replaySnakeJournal } from './snakeDurableRules.js';
function need(ok, code) { if (!ok) throw new Error(code); }
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value);

/** UNWIRED. CSPRNG is server-owned; request bodies never supply dice/results/state. */
export function createSnakeMoveJournal({ client, escrowMatches, lifecycleMatches, gameStates, gameMoves, users, now = Date.now,
  rollDie = () => randomInt(1, 7), verifyCredentials = verifySocialCredentials }) {
  need(client?.startSession && escrowMatches && lifecycleMatches && gameStates && gameMoves && users, 'journal_dependencies_required');
  return {
    async recover(matchId) {
      need(validId(matchId), 'invalid_match');
      const session = client.startSession(); let recovered;
      try {
        await session.withTransaction(async () => {
          const match = await escrowMatches.findOne({ _id: matchId }, { session });
          need(match?.matchId === matchId && match.gameType === 'snake' && match.startedAt, 'round_not_started');
          const state = await gameStates.findOne({ _id: matchId }, { session });
          const records = await gameMoves.find({ matchId }, { session }).sort({ sequence: 1 }).limit(10002).toArray();
          recovered = replaySnakeJournal(match, records, state);
        }, { readConcern: { level: 'snapshot' }, readPreference: 'primary' });
        return recovered;
      } finally { await session.endSession(); }
    },
    async roll(request) {
      const { matchId, requestId, expectedVersion, credentials } = request || {};
      need(validId(matchId) && validId(requestId) && Number.isSafeInteger(expectedVersion) && expectedVersion >= 0, 'invalid_roll_request');
      need(!['dice', 'value', 'result', 'winner', 'state', 'actor', 'accountId'].some(k => Object.hasOwn(request, k)), 'client_outcome_not_accepted');
      const claims = await verifyCredentials({ initData: credentials?.initData || '', googleIdToken: credentials?.googleIdToken || '' });
      need((claims.telegramId != null || claims.googleId) && Number.isFinite(claims.expiresAt), 'signed_identity_required');
      const selector = { ...(claims.telegramId != null ? { telegramId: claims.telegramId } : {}), ...(claims.googleId ? { googleId: claims.googleId } : {}) };
      const session = client.startSession(); let result; let die;
      try {
        await session.withTransaction(async () => {
          const at = now(); need(claims.expiresAt > at, 'credential_expired');
          const found = await users.find(selector, { session }).limit(2).toArray();
          need(found.length === 1 && !found[0].isBanned && validId(found[0].tpcAccountNumber), 'canonical_identity_required'); const user = found[0];
          const canonical = await users.find({ tpcAccountNumber: user.tpcAccountNumber }, { session }).limit(2).toArray();
          need(canonical.length === 1 && String(canonical[0]._id) === String(user._id), 'canonical_identity_ambiguous');
          const match = await escrowMatches.findOne({ _id: matchId }, { session });
          need(match?.matchId === matchId && match.gameType === 'snake' && match.reservations.some(r => r.accountId === user.tpcAccountNumber), 'round_membership_required');
          const previous = await gameMoves.findOne({ _id: journalHash([matchId, requestId]) }, { session });
          if (previous) {
            const { hash, ...body } = previous;
            need(hash === journalHash(body) && previous.matchId === matchId && previous.requestId === requestId && previous.sequence === expectedVersion + 1 && previous.kind === 'roll', 'journal_move_corrupt');
            need(previous.actor === user.tpcAccountNumber && previous.expectedVersion === expectedVersion, 'roll_idempotency_conflict');
            result = { duplicate: true, move: previous }; return;
          }
          const lifecycle = await lifecycleMatches.findOne({ _id: matchId }, { session });
          need(match.status === 'reserved' && match.startedAt && lifecycle?.status === 'playing', 'round_not_playing');
          const state = await gameStates.findOne({ _id: matchId }, { session });
          need(state?.version === expectedVersion, 'stale_game_version');
          const records = await gameMoves.find({ matchId }, { session }).sort({ sequence: 1 }).limit(10002).toArray();
          replaySnakeJournal(match, records, state); // Fail closed on corruption before appending.
          if (die === undefined) die = rollDie();
          const applied = applySnakeJournalRoll(state, { actor: user.tpcAccountNumber, requestId, dice: die, at });
          // Fence authenticated account and live financial/lifecycle record: reads
          // alone would permit concurrent ban or round finalization write skew.
          const hasFence = Object.hasOwn(user, 'gameActionFence');
          need(!hasFence || (Number.isSafeInteger(user.gameActionFence) && user.gameActionFence >= 0 && user.gameActionFence < Number.MAX_SAFE_INTEGER), 'action_fence_invalid');
          const fenced = await users.updateOne({ _id: user._id, tpcAccountNumber: user.tpcAccountNumber, ...selector, isBanned: { $ne: true }, gameActionFence: hasFence ? user.gameActionFence : { $exists: false } }, { $inc: { gameActionFence: 1 } }, { session });
          need(fenced.modifiedCount === 1, 'identity_changed');
          const live = await lifecycleMatches.updateOne({ _id: matchId, status: 'playing', version: lifecycle.version }, { $inc: { moveFence: 1 } }, { session });
          need(live.modifiedCount === 1, 'round_changed');
          const { _id, ...fields } = applied.state;
          const changed = await gameStates.updateOne({ _id: matchId, version: expectedVersion, lastHash: state.lastHash }, { $set: fields }, { session });
          need(changed.modifiedCount === 1, 'move_conflict');
          await gameMoves.insertOne(applied.move, { session });
          need(claims.expiresAt > now(), 'credential_expired');
          result = { duplicate: false, move: applied.move };
        }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
        return result;
      } finally { await session.endSession(); }
    }
  };
}
