import User from '../models/User.js';
import { incrementReferralBonus } from '../utils/userUtils.js';
import { fetchTelegramInfo } from '../utils/telegram.js';

export default function registerStart(bot) {
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const info = await fetchTelegramInfo(telegramId);
    const user = await User.findOneAndUpdate(
      { telegramId },
      {
        $set: {
          firstName: info.firstName,
          lastName: info.lastName,
          photo: info.photoUrl
        },
        $setOnInsert: { referralCode: telegramId.toString() }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const code = ctx.startPayload;
    if (code && !user.referredBy && user.referralCode !== code) {
      const inviter = await User.findOne({ referralCode: code });
      if (inviter) {
        user.referredBy = code;
        await user.save();
        await incrementReferralBonus(code);
      }
    }
    ctx.reply('Welcome to TonPlaygram!', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Open WebApp',
              web_app: { url: 'https://tonplaygramwebapp.onrender.com' }
            }
          ]
        ]
      }
    });
  });
}
