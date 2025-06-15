export default function registerLudo(bot) {
  bot.command('ludo', (ctx) =>
    ctx.reply('Play Ludo in the TonPlaygram web app: https://tonplaygramwebapp.onrender.com/games/ludo')
  );
}
