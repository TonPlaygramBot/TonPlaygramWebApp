import { Router } from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import ChessMatch from '../models/ChessMatch.js';
import Sequence from '../models/Sequence.js';
import { verifyTelegramInitData } from '../middleware/auth.js';

const router = Router();
const serviceOnly = (req, res, next) => {
  const expected = process.env.MATCHMAKING_SERVICE_SECRET;
  if (!expected || req.get('x-matchmaking-secret') !== expected) return res.status(401).json({ error: 'matchmaking_service_unauthorized' });
  next();
};
router.use(serviceOnly);

router.post('/session', async (req, res) => {
  const verified = verifyTelegramInitData(String(req.body?.initData || ''));
  if (!verified?.user) return res.status(401).json({ error: 'invalid_telegram_authentication' });
  const telegram = JSON.parse(verified.user);
  const user = await User.findOne({ telegramId: Number(telegram.id), isBanned: { $ne: true } }).lean();
  if (!user) return res.status(404).json({ error: 'registered_tpc_account_not_found' });
  const tpcAccountNumber = String(user.tpcAccountNumber || user.accountId || '');
  if (!tpcAccountNumber) return res.status(409).json({ error: 'tpc_account_number_missing' });
  res.json({ tpcAccountNumber, balance: user.balance || 0, name: user.nickname || user.firstName || telegram.first_name || 'Player', avatar: user.photo || telegram.photo_url || '', activeTableId: user.currentTableId || null });
});

router.post('/reserve', async (req, res) => {
  const accounts = [...new Set((req.body?.accounts || []).map(String))];
  const stake = Number(req.body?.stake); const roomId = String(req.body?.roomId || '');
  if (accounts.length !== 2 || !roomId || !Number.isSafeInteger(stake) || stake <= 0 || req.body?.token !== 'TPC') return res.status(400).json({ error: 'invalid_reservation' });
  const existing = await ChessMatch.findOne({ roomId }).lean();
  if (existing) return res.json({ matchId: existing.internalMatchId, tableNumber: existing.tableNumber, transactionIds: existing.stakeTransactionIds });
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const active = await ChessMatch.findOne({ status: { $in: ['reserved', 'playing'] }, $or: [{ player1TpcAccountId: { $in: accounts } }, { player2TpcAccountId: { $in: accounts } }] }).session(session);
      if (active) throw new Error('account_already_in_active_match');
      const users = await User.find({ tpcAccountNumber: { $in: accounts }, balance: { $gte: stake }, currentTableId: null }).session(session);
      if (users.length !== 2) throw new Error('insufficient_balance_or_account_busy');
      const sequence = await Sequence.findByIdAndUpdate('chess_table', { $inc: { value: 1 } }, { upsert: true, new: true, session });
      const tableNumber = `TABLE #${String(sequence.value).padStart(6, '0')}`;
      const matchId = randomUUID();
      const transactionIds = accounts.map((account) => `chess:${matchId}:reserve:${account}`);
      for (const user of users) {
        const index = accounts.indexOf(String(user.tpcAccountNumber));
        user.balance -= stake; user.currentTableId = tableNumber;
        user.transactions.push({ transactionId: transactionIds[index], amount: -stake, type: 'stake_reserve', token: 'TPC', status: 'reserved', game: 'chessbattle', players: 2, detail: matchId });
        await user.save({ session });
      }
      await ChessMatch.create([{ tableNumber, internalMatchId: matchId, roomId, player1TpcAccountId: accounts[0], player2TpcAccountId: accounts[1], stakePerPlayer: stake, totalLockedStake: stake * 2, stakeTransactionIds: transactionIds }], { session });
      result = { matchId, tableNumber, transactionIds };
    });
    res.json(result);
  } catch (error) { res.status(409).json({ error: error.message || 'reservation_failed' }); }
  finally { await session.endSession(); }
});

router.post('/release', async (req, res) => {
  const matchId = String(req.body?.matchId || ''); const session = await mongoose.startSession();
  try {
    let transactionIds = [];
    await session.withTransaction(async () => {
      const match = await ChessMatch.findOne({ internalMatchId: matchId }).session(session);
      if (!match) throw new Error('match_not_found');
      if (['cancelled', 'refunded'].includes(match.status)) { transactionIds = match.releaseTransactionIds; return; }
      if (match.status !== 'reserved') throw new Error('match_already_started');
      for (const account of [match.player1TpcAccountId, match.player2TpcAccountId]) {
        const transactionId = `chess:${matchId}:release:${account}`; transactionIds.push(transactionId);
        await User.updateOne({ tpcAccountNumber: account, 'transactions.transactionId': { $ne: transactionId } }, { $inc: { balance: match.stakePerPlayer }, $set: { currentTableId: null }, $push: { transactions: { transactionId, amount: match.stakePerPlayer, type: 'stake_refund', token: 'TPC', status: 'delivered', game: 'chessbattle', players: 2, detail: String(req.body?.reason || 'cancelled') } } }, { session });
      }
      match.status = 'refunded'; match.releaseTransactionIds = transactionIds; await match.save({ session });
    });
    res.json({ released: true, transactionIds });
  } catch (error) { res.status(409).json({ error: error.message || 'release_failed' }); }
  finally { await session.endSession(); }
});

export default router;
