import User from '../models/User.js';
import { fetchTelegramInfo } from '../utils/telegram.js';

export default function registerStart(bot) {
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const info = await fetchTelegramInfo(telegramId);
    await User.findOneAndUpdate(
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
