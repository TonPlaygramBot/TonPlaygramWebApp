import User from '../models/User.js';
import { fetchTelegramInfo } from '../utils/telegram.js';
import path from 'path';
import { fileURLToPath } from 'url';

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
      { upsert: true }
    );
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const logoPath = path.join(
      __dirname,
      '../../webapp/public/assets/TonPlayGramLogo.jpg'
    );
    await ctx.replyWithPhoto({ source: logoPath });
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
