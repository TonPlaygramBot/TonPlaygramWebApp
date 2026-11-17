import { initializeSnakeJournal, replaySnakeJournal, captureSnakeJournalResult, snakeJournalRulesHash, journalHash } from './snakeDurableRules.js';
import { fenceVerifiedGameAccount } from './gameFinancialFence.js';
import { createHash } from 'node:crypto';
import { buildReservedMatchSettlementPlan } from './reservedMatchPlan.js';
import { gameFundingFingerprint } from './snakeReservationProducer.js';
import { lifecycleCommandRecord, nextGameLifecycle } from './gameLifecycle.js';
function need(ok, code) { if (!ok) throw new Error(code); }
const digest = value => createHash('sha256').update(value).digest('hex');
const options = { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' };

/** UNWIRED. Trusted server coordinator only. No endpoints, automatic migration or real-data use. */
export function createSnakeRoundCoordinator({ client, escrowMatches, lifecycleMatches, journal, users, fundingAudits, accountLocks, receipts, gameStates, gameMoves, assetId, now = Date.now }) {
  need(client?.startSession && escrowMatches && lifecycleMatches && journal && users && fundingAudits && accountLocks && receipts && gameStates && gameMoves && assetId, 'coordinator_dependencies_required');
  async function transact(matchId, callback) {
    need(typeof matchId === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(matchId), 'invalid_match');
    const session = client.startSession(); let result;
    try { await session.withTransaction(async () => {
      const match = await escrowMatches.findOne({ _id: matchId }, { session });
      const lifecycle = await lifecycleMatches.findOne({ _id: matchId }, { session });
      need(match?.matchId === matchId && match.gameType === 'snake' && match.assetId === assetId && lifecycle?.matchId === matchId, 'round_missing_or_mismatched');
      need(Number.isSafeInteger(match.version) && match.version >= 0 && match.version < Number.MAX_SAFE_INTEGER, 'round_version_invalid');
      const at = now(); need(Number.isSafeInteger(at), 'invalid_server_time');
      result = await callback({ match, lifecycle, session, at });
    }, options); return result; } finally { await session.endSession(); }
  }
  async function move(lifecycle, kind, referenceId, at, session) {
    const event = { matchId: lifecycle.matchId, eventId: `${kind}:${lifecycle.version + 1}`, expectedVersion: lifecycle.version, at, kind, referenceId };
    const next = nextGameLifecycle(lifecycle, event); const { _id, ...fields } = next;
    const changed = await lifecycleMatches.updateOne({ _id: lifecycle.matchId, version: lifecycle.version, status: lifecycle.status }, { $set: fields }, { session });
    need(changed.modifiedCount === 1, 'lifecycle_conflict');
    const { command, eventKey, commandHash } = lifecycleCommandRecord(event);
    await journal.insertOne({ _id: eventKey, matchId: lifecycle.matchId, version: next.version, command, commandHash, state: next }, { session });
    return next;
  }
  async function verifiedAccount(accountId, session) {
    const found = await users.find({ tpcAccountNumber: accountId }, { session }).limit(2).toArray();
    need(found.length === 1 && !found[0].isBanned, 'canonical_account_unavailable'); const user = found[0];
    need(Number.isSafeInteger(user.balance) && user.balance >= 0 && Array.isArray(user.transactions), 'unsafe_ledger');
    const audit = await fundingAudits.findOne({ _id: accountId }, { session });
    need(audit?.assetId === assetId && audit.userId === String(user._id) && audit.status === 'verified' &&
      Number.isSafeInteger(audit.version) && audit.version >= 0 && audit.version < Number.MAX_SAFE_INTEGER &&
      audit.availableUnits === String(user.balance) && audit.fingerprint === gameFundingFingerprint(user), 'funding_provenance_required');
    return { user, audit };
  }
  async function heldParticipant(reservation, match, session) {
    const account = await verifiedAccount(reservation.accountId, session);
    const lock = await accountLocks.findOne({ _id: reservation.accountId }, { session });
    need(lock?.matchId === match.matchId && lock.assetId === assetId && lock.userId === String(account.user._id), 'round_lock_missing');
    const rows = account.user.transactions.filter(t => t.transactionId === reservation.receiptId);
    need(reservation.matchId === match.matchId && reservation.assetId === assetId && reservation.status === 'held' && rows.length === 1 &&
      rows[0].amount === -Number(reservation.units) && rows[0].type === 'stake_reserve' && rows[0].status === 'reserved' &&
      rows[0].game === 'snake' && rows[0].token === 'TPG' && rows[0].detail === match.matchId, 'held_debit_missing');
    return { ...account, lock };
  }
  async function complete({ match, lifecycle, session, at }, refund) {
    const key = `game-settlement:${match.matchId}`;
    const existing = await receipts.findOne({ _id: key }, { session });
    if (existing) {
      need(match.status === (refund ? 'refunded' : 'settled') && match.settlementKey === key && existing.plan?.matchId === match.matchId &&
        existing.assetId === assetId && existing.plan?.settlementKey === key && existing.decision?.decisionId === match.result?.decisionId && existing.plan?.kind === (refund ? 'cancel_before_start' : 'winner') &&
        lifecycle.status === (refund ? 'refunded' : 'settled'), 'terminal_receipt_conflict');
      return { duplicate: true, receipt: existing };
    }
    need(match.status === 'reserved', 'round_not_reserved');
    need(refund ? match.startedAt === null && ['reserved', 'refund_pending'].includes(lifecycle.status) :
      typeof match.startedAt === 'string' && lifecycle.status === 'playing', 'round_lifecycle_mismatch');
    let replayedDecision;
    if (!refund) {
      const persisted = await gameStates.findOne({ _id: match.matchId }, { session });
      const records = await gameMoves.find({ matchId: match.matchId }, { session }).sort({ sequence: 1 }).limit(10002).toArray();
      replayedDecision = captureSnakeJournalResult(match, replaySnakeJournal(match, records, persisted));
    }
    const decision = refund ? { kind: 'cancel_before_start', matchId: match.matchId, gameType: 'snake', decisionId: `refund:${digest(match.matchId)}` } : replayedDecision;
    const plan = buildReservedMatchSettlementPlan(match, decision);
    need(BigInt(plan.totalUnits) <= BigInt(Number.MAX_SAFE_INTEGER), 'unsafe_ledger_amount');
    const accounts = new Map();
    for (const reservation of match.reservations) accounts.set(reservation.accountId, { ...await heldParticipant(reservation, match, session), reservation });
    for (const transfer of plan.transfers) if (!accounts.has(transfer.accountId)) accounts.set(transfer.accountId, await verifiedAccount(transfer.accountId, session));
    for (const [accountId, { user, audit, reservation }] of accounts) {
      let amount = 0;
      const ledger = user.transactions.map(t => reservation && t.transactionId === reservation.receiptId ? { ...t, status: refund ? 'refunded' : 'settled' } : t);
      plan.transfers.forEach((transfer, index) => {
        if (transfer.accountId !== accountId) return;
        const transactionId = `${key}:${index}`;
        need(!ledger.some(t => t.transactionId === transactionId), 'orphan_credit');
        const credit = Number(transfer.units); amount += credit;
        ledger.push({ transactionId, amount: credit, type: refund ? 'stake_refund' : transfer.kind === 'fee' ? 'house_fee' : 'stake_payout', token: 'TPG', status: 'delivered', game: 'snake', players: match.reservations.length, detail: match.matchId, date: new Date(at) });
      });
      need(Number.isSafeInteger(user.balance + amount), 'unsafe_credit');
      const updated = { ...user, balance: user.balance + amount, transactions: ledger };
      const changed = await users.updateOne({ _id: user._id, tpcAccountNumber: accountId, balance: user.balance, transactions: user.transactions, isBanned: { $ne: true } },
        { $set: { balance: updated.balance, transactions: ledger } }, { session });
      need(changed.modifiedCount === 1, 'credit_conflict');
      const advanced = await fundingAudits.updateOne({ _id: accountId, version: audit.version, fingerprint: audit.fingerprint },
        { $set: { fingerprint: gameFundingFingerprint(updated), availableUnits: String(updated.balance) }, $inc: { version: 1 } }, { session });
      need(advanced.modifiedCount === 1, 'audit_conflict');
      if (reservation) { const released = await accountLocks.deleteOne({ _id: accountId, matchId: match.matchId, assetId }, { session }); need(released.deletedCount === 1, 'lock_release_conflict'); }
    }
    const changed = await escrowMatches.updateOne({ _id: match.matchId, status: 'reserved', version: match.version },
      { $set: { status: refund ? 'refunded' : 'settled', settlementKey: key, result: decision }, $inc: { version: 1 } }, { session });
    need(changed.modifiedCount === 1, 'settlement_conflict');
    if (refund) {
      if (lifecycle.status === 'reserved') lifecycle = await move(lifecycle, 'cancel', null, at, session);
      lifecycle = await move(lifecycle, 'refund_committed', `receipt:${digest(key)}`, at, session);
    } else {
      lifecycle = await move(lifecycle, 'server_finish', decision.evidenceId, at, session);
      lifecycle = await move(lifecycle, 'settlement_committed', `receipt:${digest(key)}`, at, session);
    }
    const receipt = { _id: key, referenceId: `receipt:${digest(key)}`, matchId: match.matchId, assetId, plan, decision, createdAt: at };
    await receipts.insertOne(receipt, { session }); return { duplicate: false, receipt };
  }
  return {
    start(matchId, initialBoard, turnOrder) {
      return transact(matchId, async ({ match, lifecycle, session, at }) => {
        need(snakeJournalRulesHash(match.rulesVersion, initialBoard) === match.rulesHash && Array.isArray(turnOrder) && Array.isArray(match.turnOrder) && journalHash(turnOrder) === journalHash(match.turnOrder), 'initial_rules_mismatch');
        if (match.startedAt !== null) {
          need(match.status === 'reserved' && lifecycle.status === 'playing' && journalHash(turnOrder) === journalHash(match.turnOrder), 'round_already_advanced');
          return { duplicate: true, match };
        }
        need(match.status === 'reserved' && lifecycle.status === 'reserved', 'round_not_startable');
        // A valid all-held roster is required even before a winner exists.
        buildReservedMatchSettlementPlan(match, { kind: 'cancel_before_start', matchId, gameType: 'snake', decisionId: 'validate-start' });
        const checked = [];
        for (const reservation of match.reservations) checked.push(await heldParticipant(reservation, match, session));
        if (BigInt(match.feePolicy?.units || '0') > 0n) checked.push(await verifiedAccount(match.feePolicy.accountId, session));
        for (const account of checked) {
          await fenceVerifiedGameAccount({ users, fundingAudits, ...account, session });
          if (account.lock) {
            const fence = account.lock.startFence;
            need(fence == null || (Number.isSafeInteger(fence) && fence >= 0 && fence < Number.MAX_SAFE_INTEGER), 'lock_fence_invalid');
            const held = await accountLocks.updateOne({ _id: account.user.tpcAccountNumber, matchId, assetId, userId: String(account.user._id) }, { $inc: { startFence: 1 } }, { session });
            need(held.modifiedCount === 1, 'lock_fence_conflict');
          }
        }
        const initial = initializeSnakeJournal(match, initialBoard, turnOrder, at);
        const startedAt = new Date(at).toISOString();
        const changed = await escrowMatches.updateOne({ _id: matchId, status: 'reserved', version: match.version, startedAt: null },
          { $set: { startedAt, initialBoard: structuredClone(initialBoard), turnOrder: [...turnOrder] }, $inc: { version: 1 } }, { session });
        need(changed.modifiedCount === 1, 'start_conflict');
        await gameStates.insertOne(initial.state, { session });
        await gameMoves.insertOne(initial.genesis, { session });
        await move(lifecycle, 'start', null, at, session);
        return { duplicate: false, match: { ...match, startedAt, turnOrder: [...turnOrder], initialBoard: structuredClone(initialBoard), version: match.version + 1 } };
      });
    },
    finish: (matchId, suppliedOutcome) => {
      if (suppliedOutcome !== undefined) return Promise.reject(new Error('client_outcome_not_accepted'));
      return transact(matchId, state => complete(state, false));
    },
    refundBeforeStart: matchId => transact(matchId, state => complete(state, true))
  };
}
