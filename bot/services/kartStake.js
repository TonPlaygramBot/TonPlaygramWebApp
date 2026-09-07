import mongoose from 'mongoose';
import User from '../models/User.js';
import KartMatch from '../models/KartMatch.js';

const identity = (account) => ({
  $or: [{ tpcAccountNumber: account }, { accountId: account }]
});
const receipt = (match) => ({
  status: match.status,
  winnerAccountId: match.winnerAccountId || null,
  amount: match.amount || 0,
  reason: match.reason || ''
});
const makeTransaction = (prefix, gameType, match, account, kind, amount, detail) => ({
  transactionId: `${prefix}:${match.tableId}:${kind}:${account}`,
  amount,
  type:
    kind === 'reserve'
      ? 'stake_reserve'
      : kind === 'paid'
        ? 'stake_payout'
        : 'stake_refund',
  token: 'TPG',
  status: kind === 'reserve' ? 'reserved' : 'delivered',
  game: gameType,
  players: match.accounts.length,
  detail: detail || match.tableId
});

/** No client debit, refund or result report participates in this ledger. */
export function createKartStakeService({
  UserModel = User,
  MatchModel = KartMatch,
  database = mongoose,
  gameType = 'kartroyale',
  ledgerPrefix = 'kart',
  maxPlayers = 6,
  reservationTtlMs = 10 * 60_000
} = {}) {
  const transaction = (...args) => makeTransaction(ledgerPrefix, gameType, ...args);
  async function canQueue(account, stake, tableId = '') {
    if (database.connection.readyState !== 1)
      throw new Error('matchmaker_unavailable');
    const user = await UserModel.findOne({
      ...identity(account),
      isBanned: { $ne: true }
    }).lean();
    if (!user) throw new Error('account_missing');
    if (user.currentTableId && user.currentTableId !== tableId)
      throw new Error('account_already_in_active_match');
    if (!user.currentTableId && Number(user.balance || 0) < stake)
      throw new Error('insufficient_balance');
  }

  async function reserve(table) {
    const accounts = table.players.map((p) =>
      String(p.tpcAccountNumber || p.id || '')
    );
    const stake = Number(table.stake);
    if (
      accounts.length < 2 ||
      accounts.length > maxPlayers ||
      accounts.some((id) => !id) ||
      new Set(accounts).size !== accounts.length ||
      !Number.isSafeInteger(stake) ||
      stake <= 0 ||
      !Number.isSafeInteger(stake * accounts.length)
    )
      throw new Error(`invalid_${ledgerPrefix}_stake_contract`);
    const session = await database.startSession();
    try {
      await session.withTransaction(async () => {
        const existing = await MatchModel.findOne({
          tableId: table.id
        }).session(session);
        if (existing) {
          if (
            existing.status !== 'playing' ||
            existing.stake !== stake ||
            existing.accounts.join('|') !== accounts.join('|')
          )
            throw new Error('match_already_closed');
          return;
        }
        const active = await MatchModel.findOne({
          accounts: { $in: accounts },
          status: 'playing'
        }).session(session);
        if (active) throw new Error('account_already_in_active_match');
        const match = {
          tableId: table.id,
          accounts,
          stake,
          expiresAt: new Date(Date.now() + reservationTtlMs)
        };
        // Conditional writes and the transaction prevent a double seat, partial
        // reservation, negative balance, or aliases charging the same user twice.
        for (const account of accounts) {
          const updated = await UserModel.updateOne(
            {
              ...identity(account),
              isBanned: { $ne: true },
              currentTableId: null,
              balance: { $gte: stake }
            },
            {
              $inc: { balance: -stake },
              $set: { currentTableId: table.id },
              $push: {
                transactions: transaction(match, account, 'reserve', -stake)
              }
            },
            { session }
          );
          if (updated.modifiedCount !== 1)
            throw new Error('insufficient_balance_or_account_busy');
        }
        await MatchModel.create([match], { session });
      });
    } finally {
      await session.endSession();
    }
    return { matchId: table.id };
  }

  async function settle(
    tableId,
    { winnerAccountId = '', reason = 'race_complete' } = {}
  ) {
    const session = await database.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const match = await MatchModel.findOne({ tableId }).session(session);
        if (!match) throw new Error('match_not_found');
        if (match.status !== 'playing') {
          result = receipt(match);
          return;
        }
        if (winnerAccountId && !match.accounts.includes(winnerAccountId))
          throw new Error('winner_not_in_match');
        match.status = winnerAccountId ? 'paid' : 'refunded';
        match.winnerAccountId = winnerAccountId || undefined;
        match.amount = winnerAccountId
          ? match.stake * match.accounts.length
          : match.stake;
        match.reason = reason;
        match.settledAt = new Date();
        for (const account of match.accounts) {
          const amount =
            !winnerAccountId || account === winnerAccountId ? match.amount : 0;
          if (amount) {
            const tx = transaction(
              match,
              account,
              match.status,
              amount,
              reason
            );
            const updated = await UserModel.updateOne(
              {
                ...identity(account),
                'transactions.transactionId': { $ne: tx.transactionId }
              },
              { $inc: { balance: amount }, $push: { transactions: tx } },
              { session }
            );
            if (updated.modifiedCount !== 1)
              throw new Error('settlement_account_missing');
          }
          await UserModel.updateOne(
            { ...identity(account), currentTableId: tableId },
            {
              $set: { currentTableId: null }
            },
            { session }
          );
        }
        await match.save({ session });
        result = receipt(match);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async function recoverExpired() {
    if (database.connection.readyState !== 1) return;
    const expired = await MatchModel.find({
      status: 'playing',
      expiresAt: { $lte: new Date() }
    })
      .select('tableId')
      .lean();
    for (const match of expired)
      await settle(match.tableId, { reason: 'expired_match_refund' });
  }
  return { canQueue, reserve, settle, recoverExpired };
}
