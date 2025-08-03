const bannedWords = ['spam', 'scam'];

export default function registerModeration(bot) {
  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text.toLowerCase();
    if (bannedWords.some((w) => text.includes(w))) {
      try {
        await ctx.deleteMessage();
        await ctx.reply('Message removed: violates group rules.');
      } catch (err) {
        console.error('Failed to delete message:', err);
      }
    } else {
      return next();
    }
  });
}
