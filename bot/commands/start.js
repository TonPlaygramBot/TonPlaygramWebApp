import User from '../models/User.js';

export default function registerStart(bot) {
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    await User.findOneAndUpdate(
      { telegramId },
      { $setOnInsert: { referralCode: telegramId.toString() } },
      { upsert: true }
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
