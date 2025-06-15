import User from '../models/User.js';
import { ensureTransactionArray } from '../utils/userUtils.js';

export default function registerWallet(bot) {
  bot.command('wallet', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    const sub = parts[1];
    const telegramId = ctx.from.id;

    switch (sub) {
      case 'balance': {
        const user = await User.findOne({ telegramId });
        const balance = user ? user.balance : 0;
        ctx.reply(`Your balance is ${balance} TPC.`);
        break;
      }
      case 'send': {
        const toId = Number(parts[2]);
        const amount = Number(parts[3]);
        if (!toId || isNaN(amount)) {
          ctx.reply('Usage: /wallet send <telegramId> <amount>');
          return;
        }
        if (amount <= 0) {
          ctx.reply('Amount must be positive');
          return;
        }
        const sender = await User.findOne({ telegramId });
        if (!sender || sender.balance < amount) {
          ctx.reply('Insufficient balance');
          return;
        }
        ensureTransactionArray(sender);
        let receiver = await User.findOneAndUpdate(
          { telegramId: toId },
          { $inc: { balance: amount }, $setOnInsert: { referralCode: toId.toString() } },
          { upsert: true, new: true }
        );
        ensureTransactionArray(receiver);
        sender.balance -= amount;
        const txDate = new Date();
        const senderTx = {
          amount: -amount,
          type: 'send',
          status: 'delivered',
          date: txDate
        };
        const receiverTx = {
          amount,
          type: 'receive',
          status: 'delivered',
          date: txDate
        };
        sender.transactions.push(senderTx);
        receiver.transactions.push(receiverTx);
        await sender.save();
        await receiver.save();
        try {
          await ctx.telegram.sendMessage(String(toId), `You received ${amount} TPC from ${telegramId}`);
        } catch (err) {
          console.error('Failed to send Telegram notification:', err.message);
        }
        ctx.reply(`Sent ${amount} TPC to ${toId}. Balance: ${sender.balance}`);
        break;
      }
      default:
        ctx.reply(
          'Wallet commands:\n' +
            '/wallet balance - show your TPC balance\n' +
            '/wallet send <telegramId> <amount> - send TPC to another user'
        );
    }
  });
}
