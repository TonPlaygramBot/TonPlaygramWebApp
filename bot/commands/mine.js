import User from '../models/User.js';

export default function registerMine(bot) {
  bot.command('mine', async (ctx) => {
    const sub = ctx.message.text.split(' ')[1];
    if (['start', 'stop', 'claim'].includes(sub)) {
      return ctx.reply('Mining rewards are unavailable until verified settlement is enabled.');
    }
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply('Open TonPlayGram to create your account first.');
    if (user.isBanned) return ctx.reply('This account is unavailable.');
    // Status must not credit elapsed sessions or save a stale account snapshot.
    return ctx.reply(`Mining: ${user.isMining ? 'active' : 'inactive'}\nPending rewards: ${user.minedTPC} TPG\nBalance: ${user.balance}\nReward settlement is currently paused.`);
  });
}
