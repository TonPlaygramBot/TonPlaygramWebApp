import User from '../models/User.js';
import { calculateBoost } from '../utils/miningUtils.js';

export default function registerReferral(bot) {
  bot.command('referral', async (ctx) => {
    const telegramId = ctx.from.id;
    const user = await User.findOneAndUpdate(
      { telegramId },
      { $setOnInsert: { referralCode: telegramId.toString() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const count = await User.countDocuments({ referredBy: user.referralCode });
    const link = `https://t.me/${process.env.BOT_USERNAME || 'YourBot'}?start=${user.referralCode}`;
    const storeRate =
      user.storeMiningRate && user.storeMiningExpiresAt &&
      user.storeMiningExpiresAt > new Date()
        ? user.storeMiningRate
        : 0;
    const totalRate = calculateBoost(count) + storeRate;
    ctx.reply(
      `Invite friends to increase your mining rate!\nReferral link: ${link}\nFriends invited: ${count}\nMining boost: +${totalRate * 100}%`
    );
  });
}
