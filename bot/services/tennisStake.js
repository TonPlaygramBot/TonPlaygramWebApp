import mongoose from 'mongoose';
import User from '../models/User.js';
import TennisMatch from '../models/TennisMatch.js';
import {
  findMemoryUser,
  saveMemoryUser,
  shouldUseMemoryUserStore
} from '../utils/memoryUserStore.js';

const memoryMatches = new Map();
const identity = (id) => ({
  $or: [{ tpcAccountNumber: id }, { accountId: id }]
});
const transaction = (tableId, id, amount, type) => ({
  transactionId: `tennis:${tableId}:${type}:${id}`,
  amount,
  type,
  token: 'TPG',
  status: type === 'stake_reserve' ? 'reserved' : 'delivered',
  game: 'tennisroyal',
  players: 2,
  detail: tableId
});
const terminal = (m) => m.status !== 'playing';
export async function reserveTennisStake(table) {
  const accounts = table.players.map((p) => String(p.tpcAccountNumber || p.id)),
    stake = Number(table.stake),
    tableId = String(table.id);
  if (
    accounts.length !== 2 ||
    new Set(accounts).size !== 2 ||
    !Number.isSafeInteger(stake) ||
    stake <= 0
  )
    throw Error('invalid_tennis_stake');
  const record = {
    tableId,
    accounts,
    stake,
    status: 'playing',
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
  };
  if (shouldUseMemoryUserStore()) {
    const previous = memoryMatches.get(tableId);
    if (previous) {
      if (terminal(previous)) throw Error('match_finished');
      return previous;
    }
    if (
      [...memoryMatches.values()].some(
        (m) => !terminal(m) && m.accounts.some((a) => accounts.includes(a))
      )
    )
      throw Error('account_already_in_active_match');
    const users = accounts.map((accountId) => findMemoryUser({ accountId }));
    if (users.some((u) => !u || u.isBanned || Number(u.balance) < stake))
      throw Error('insufficient_balance');
    users.forEach((u, i) =>
      saveMemoryUser({
        ...u,
        balance: u.balance - stake,
        currentTableId: tableId,
        transactions: [
          ...(u.transactions || []),
          transaction(tableId, accounts[i], -stake, 'stake_reserve')
        ]
      })
    );
    memoryMatches.set(tableId, record);
    return record;
  }
  await TennisMatch.init();
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const existing = await TennisMatch.findOne({ tableId }).session(session);
      if (existing) {
        if (terminal(existing)) throw Error('match_finished');
        result = existing;
        return;
      }
      if (
        await TennisMatch.exists({
          accounts: { $in: accounts },
          status: 'playing'
        }).session(session)
      )
        throw Error('account_already_in_active_match');
      for (const id of accounts) {
        const changed = await User.updateOne(
          {
            ...identity(id),
            balance: { $gte: stake },
            isBanned: { $ne: true }
          },
          {
            $inc: { balance: -stake },
            $set: { currentTableId: tableId },
            $push: {
              transactions: transaction(tableId, id, -stake, 'stake_reserve')
            }
          },
          { session }
        );
        if (changed.modifiedCount !== 1) throw Error('insufficient_balance');
      }
      [result] = await TennisMatch.create([record], { session });
    });
    return result;
  } finally {
    await session.endSession();
  }
}
export async function settleTennisStake(
  tableId,
  winner = null,
  reason = 'completed'
) {
  const apply = (m) => {
    if (winner && !m.accounts.includes(String(winner)))
      throw Error('invalid_winner');
    return winner
      ? [{ id: String(winner), amount: m.stake * 2, type: 'stake_payout' }]
      : m.accounts.map((id) => ({ id, amount: m.stake, type: 'stake_refund' }));
  };
  if (shouldUseMemoryUserStore()) {
    const m = memoryMatches.get(tableId);
    if (!m) throw Error('match_not_found');
    if (terminal(m)) return m;
    const payments = apply(m);
    for (const p of payments) {
      const u = findMemoryUser({ accountId: p.id });
      if (!u) throw Error('account_missing');
    }
    for (const p of payments) {
      const u = findMemoryUser({ accountId: p.id });
      saveMemoryUser({
        ...u,
        balance: Number(u.balance) + p.amount,
        transactions: [
          ...(u.transactions || []),
          transaction(tableId, p.id, p.amount, p.type)
        ]
      });
    }
    for (const id of m.accounts) {
      const u = findMemoryUser({ accountId: id });
      if (u?.currentTableId === tableId)
        saveMemoryUser({ ...u, currentTableId: null });
    }
    Object.assign(m, {
      status: winner ? 'finished' : 'refunded',
      winner,
      reason,
      settledAt: new Date()
    });
    return m;
  }
  await TennisMatch.init();
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const m = await TennisMatch.findOne({ tableId }).session(session);
      if (!m) throw Error('match_not_found');
      if (terminal(m)) {
        result = m;
        return;
      }
      for (const p of apply(m)) {
        const changed = await User.updateOne(
          identity(p.id),
          {
            $inc: { balance: p.amount },
            $push: {
              transactions: transaction(tableId, p.id, p.amount, p.type)
            }
          },
          { session }
        );
        if (changed.modifiedCount !== 1) throw Error('account_missing');
      }
      await User.updateMany(
        { currentTableId: tableId },
        { $set: { currentTableId: null } },
        { session }
      );
      Object.assign(m, {
        status: winner ? 'finished' : 'refunded',
        winner,
        reason,
        settledAt: new Date()
      });
      await m.save({ session });
      result = m;
    });
    return result;
  } finally {
    await session.endSession();
  }
}
export async function refundExpiredTennisStakes() {
  const now = new Date();
  const matches = shouldUseMemoryUserStore()
    ? [...memoryMatches.values()].filter(
        (m) => !terminal(m) && m.expiresAt <= now
      )
    : await TennisMatch.find({ status: 'playing', expiresAt: { $lte: now } })
        .limit(30)
        .lean();
  for (const m of matches)
    await settleTennisStake(m.tableId, null, 'match_expired');
}
