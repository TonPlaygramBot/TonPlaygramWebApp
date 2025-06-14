import User from '../models/User.js';

async function fetchTelegramInfo(telegramId, token) {
  const base = `https://api.telegram.org/bot${token}`;
  const chatResp = await fetch(`${base}/getChat?chat_id=${telegramId}`);
  const chatData = await chatResp.json();
  let photoUrl = '';
  const photoResp = await fetch(
    `${base}/getUserProfilePhotos?user_id=${telegramId}&limit=1`
  );
  const photoData = await photoResp.json();
  if (photoData.ok && photoData.result.total_count > 0) {
    const fileId = photoData.result.photos[0][0].file_id;
    const fileResp = await fetch(`${base}/getFile?file_id=${fileId}`);
    const fileData = await fileResp.json();
    if (fileData.ok) {
      photoUrl = `${base.replace('/bot', '/file/bot')}/${fileData.result.file_path}`;
    }
  }
  return {
    firstName: chatData.result?.first_name || '',
    lastName: chatData.result?.last_name || '',
    photoUrl
  };
}

export default function registerStart(bot) {
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const info = await fetchTelegramInfo(telegramId, process.env.BOT_TOKEN);
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
