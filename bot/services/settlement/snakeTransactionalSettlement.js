import { buildReservedMatchSettlementPlan } from './reservedMatchPlan.js';
import { captureSnakeServerResult } from './snakeServerResult.js';

/**
 * UNWIRED DRAFT. Native Mongo collections/session supplied by a trusted composition
 * root. No routes invoke this service. No transactions/indexes run at import time.
 * Requires a future durable reservation producer + provenance migration before use.
 */
export function createSnakeTransactionalSettlement({ client, matches, users, receipts, assetId }) {
  if (!client?.startSession || !matches || !users || !receipts || typeof assetId !== 'string' || !assetId) {
    throw new Error('settlement_dependencies_required');
  }
  return async function settleFinishedServerRoom(matchId, room) {
    if (typeof matchId !== 'string' || !matchId) throw new Error('invalid_match');
    const session = client.startSession();
    let outcome;
    try {
      await session.withTransaction(async () => {
        // Callback may be retried by Mongo. Never emit notifications from here.
        outcome = undefined;
        const match = await matches.findOne({ _id: matchId }, { session });
        if (!match || match.matchId !== matchId || match.gameType !== 'snake' || match.assetId !== assetId) throw new Error('match_missing_or_wrong_asset');
        const key = `game-settlement:${matchId}`;
        const existing = await receipts.findOne({ _id: key }, { session });
        if (existing) {
          if (match.status !== 'settled' || match.settlementKey !== key || existing.matchId !== matchId || existing.assetId !== assetId ||
              existing.plan?.settlementKey !== key || existing.plan?.assetId !== assetId ||
              !match.result?.evidenceId || existing.decision?.evidenceId !== match.result.evidenceId) throw new Error('inconsistent_settlement_receipt');
          outcome = { duplicate: true, receipt: existing }; return;
        }
        if (match.status !== 'reserved' || !Number.isSafeInteger(match.version) || match.version < 0 || !match.startedAt) throw new Error('match_not_settleable');
        const decision = captureSnakeServerResult(room, match);
        const plan = buildReservedMatchSettlementPlan(match, decision);
        if (BigInt(plan.totalUnits) > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('legacy_ledger_amount_unsafe');
        // Every reservation must trace to an exact debit in its canonical account.
        // This is necessary but NOT sufficient while other legacy writers can
        // fabricate ledger entries. Keep paid play off until provenance is secured.
        for (const reservation of match.reservations) {
          const found = await users.find({ tpcAccountNumber: reservation.accountId }, { session }).limit(2).toArray();
          if (found.length !== 1) throw new Error('canonical_account_missing_or_ambiguous');
          const rows = (found[0].transactions || []).filter(t => t.transactionId === reservation.receiptId);
          if (rows.length !== 1 || rows[0].amount !== -Number(reservation.units) || rows[0].type !== 'stake_reserve' ||
              rows[0].token !== 'TPG' || rows[0].status !== 'reserved' || rows[0].game !== 'snake' || rows[0].detail !== matchId) throw new Error('reservation_debit_missing');
          const user = found[0];
          const consumed = await users.updateOne({ _id: user._id, tpcAccountNumber: reservation.accountId, transactions: user.transactions }, {
            $set: { transactions: user.transactions.map(t => t.transactionId === reservation.receiptId ? { ...t, status: 'settled' } : t) }
          }, { session });
          if (consumed.modifiedCount !== 1) throw new Error('reservation_consume_conflict');
        }
        const claimed = await matches.updateOne({ _id: matchId, status: 'reserved', version: match.version }, {
          $set: { status: 'settled', settlementKey: key, result: decision }, $inc: { version: 1 }
        }, { session });
        if (claimed.modifiedCount !== 1) throw new Error('settlement_conflict');
        for (let index = 0; index < plan.transfers.length; index++) {
          const transfer = plan.transfers[index];
          const found = await users.find({ tpcAccountNumber: transfer.accountId }, { session }).limit(2).toArray();
          if (found.length !== 1) throw new Error('canonical_account_missing_or_ambiguous');
          const user = found[0]; const amount = Number(transfer.units);
          if (!Number.isSafeInteger(user.balance) || user.balance < 0 || !Number.isSafeInteger(user.balance + amount) || !Array.isArray(user.transactions)) throw new Error('legacy_balance_unsafe');
          const transactionId = `${key}:${index}`;
          if (user.transactions.some(t => t.transactionId === transactionId)) throw new Error('orphan_settlement_credit');
          const credited = await users.updateOne({ _id: user._id, tpcAccountNumber: transfer.accountId,
            balance: user.balance, transactions: user.transactions }, {
            $inc: { balance: amount }, $push: { transactions: { transactionId, amount, type: transfer.kind === 'fee' ? 'house_fee' : 'stake_payout',
              token: 'TPG', status: 'delivered', game: 'snake', players: match.reservations.length, detail: matchId, date: new Date() } }
          }, { session });
          if (credited.modifiedCount !== 1) throw new Error('credit_conflict');
        }
        const receipt = { _id: key, matchId, assetId, decision, plan, createdAt: new Date() };
        await receipts.insertOne(receipt, { session }); // _id is a durable unique key.
        outcome = { duplicate: false, receipt };
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
      if (!outcome) throw new Error('transaction_without_result');
      return outcome;
    } finally { await session.endSession(); }
  };
}
