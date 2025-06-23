export default function registerGrid(bot) {
  bot.command('grid', (ctx) =>
    ctx.reply('Play Grid Roller in the TonPlaygram web app: https://tonplaygramwebapp.onrender.com/games/grid')
  );
}
