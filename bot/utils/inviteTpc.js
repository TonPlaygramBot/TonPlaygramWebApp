import User from '../models/User.js';
import { ensureTransactionArray } from './userUtils.js';

export async function transferInviteTpc(fromId, toId, amount = 1) {
  if (!fromId || !toId || amount <= 0) return;

  const sender = await User.findOne({ telegramId: fromId });
  if (!sender || sender.balance < amount) return;

  const receiver = await User.findOneAndUpdate(
    { telegramId: toId },
    { $setOnInsert: { referralCode: String(toId) } },
    { upsert: true, new: true },
  );

  ensureTransactionArray(sender);
  ensureTransactionArray(receiver);

  const txDate = new Date();

  sender.balance -= amount;
  receiver.balance += amount;

  sender.transactions.push({
    amount: -amount,
    type: 'invite',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    toAccount: String(toId),
  });

  receiver.transactions.push({
    amount,
    type: 'invite',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    fromAccount: String(fromId),
  });

  await Promise.all([sender.save(), receiver.save()]);
}
