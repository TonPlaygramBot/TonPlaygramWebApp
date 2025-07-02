import User from '../models/User.js';

export default function registerReferral(bot) {
  bot.command('referral', async (ctx) => {
    const telegramId = ctx.from.id;
    const user = await User.findOneAndUpdate(
      { telegramId },
      { $setOnInsert: { referralCode: telegramId.toString() } },
      { upsert: true, new: true }
    );
    const count = await User.countDocuments({ referredBy: user.referralCode });
    const link = `https://t.me/${process.env.BOT_USERNAME || 'YourBot'}?start=${user.referralCode}`;
    ctx.reply(
      `Invite friends to increase your mining rate!\nReferral link: ${link}\nFriends invited: ${count}\nMining boost: +${(user.bonusMiningRate || 0) * 100}%`
    );
  });
}
