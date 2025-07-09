import User from '../models/User.js';
import { startMining, stopMining, claimRewards, updateMiningRewards } from '../utils/miningUtils.js';

export default function registerMine(bot) {
  bot.command('mine', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    const sub = parts[1];
    const telegramId = ctx.from.id;
    const user = await User.findOneAndUpdate(
      { telegramId },
      { $setOnInsert: { referralCode: telegramId.toString() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    switch (sub) {
      case 'start':
        if (user.isMining) {
          ctx.reply('Mining already in progress.');
        } else {
          await startMining(user);
          ctx.reply('Mining started.');
        }
        break;
      case 'stop':
        if (!user.isMining) {
          ctx.reply('Mining is not active.');
        } else {
          await stopMining(user);
          ctx.reply(`Mining stopped. Pending rewards: ${user.minedTPC} TPC. Balance: ${user.balance}`);
        }
        break;
      case 'claim':
        const amount = await claimRewards(user);
        ctx.reply(`You claimed ${amount} TPC. New balance: ${user.balance}`);
        break;
      case 'status':
      default:
        await updateMiningRewards(user);
        await user.save();
        ctx.reply(`Mining: ${user.isMining ? 'active' : 'inactive'}\nPending rewards: ${user.minedTPC} TPC\nBalance: ${user.balance}`);
        break;
    }
  });
}
