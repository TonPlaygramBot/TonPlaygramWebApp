import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';

const app = express();
const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const bot = new Telegraf(botToken);

bot.start((ctx) => {
  ctx.reply('🔥 TONPLAYGRAM BOT  |  Play. Earn. Dominate.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Launch WebApp', url: process.env.WEBAPP_URL || 'https://example.com' }],
        [
          { text: '🐦 Join Our Community', url: 'https://twitter.com/TonPlaygram' },
          { text: '💬 Join Our Community', url: 'https://t.me/TonPlaygramChat' }
        ]
      ]
    }
  });
});

bot.command('mine', (ctx) => ctx.reply('Mining feature coming soon!'));
bot.command('newdice', (ctx) => ctx.reply('Dice duel created!'));
bot.command('newludo', (ctx) => ctx.reply('Ludo game created!'));
bot.command('newhorse', (ctx) => ctx.reply('Horse racing room created!'));
bot.command('newsnake', (ctx) => ctx.reply('Snake & Ladders room created!'));

app.use(express.json());
app.post(`/bot${botToken}`, (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

app.get('/', (_req, res) => {
  res.send('TonPlaygram Bot running');
});

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  if (process.env.NODE_ENV === 'production') {
    await bot.telegram.deleteWebhook();
    const url = process.env.RENDER_EXTERNAL_URL || `https://example.com`;
    await bot.telegram.setWebhook(`${url}/bot${botToken}`);
  } else {
    bot.launch();
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
