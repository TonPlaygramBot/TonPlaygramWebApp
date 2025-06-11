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
    const link = `https://t.me/${bot.botInfo.username}?start=${user.referralCode}`;
    ctx.reply(`Your referral code: ${user.referralCode}\nReferrals: ${count}\nInvite link: ${link}`);
  });
}
