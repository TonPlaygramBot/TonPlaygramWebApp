export default function registerAnnounce(bot) {
  bot.command('announce', async (ctx) => {
    const message = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (!message) {
      return ctx.reply('Usage: /announce <message>');
    }
    const chatId = ctx.chat.id;
    const member = await ctx.telegram.getChatMember(chatId, ctx.from.id);
    if (member.status !== 'creator' && member.status !== 'administrator') {
      return ctx.reply('Only admins can make announcements.');
    }
    await ctx.telegram.sendMessage(chatId, message);
  });
}
