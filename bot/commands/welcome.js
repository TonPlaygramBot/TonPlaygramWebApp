export default function registerWelcome(bot) {
  bot.on('new_chat_members', async (ctx) => {
    for (const member of ctx.message.new_chat_members) {
      if (member.is_bot) {
        try {
          await ctx.banChatMember(member.id);
        } catch (err) {
          console.error('Failed to ban bot:', err);
        }
      } else {
        await ctx.reply(`Welcome, ${member.first_name}!`);
      }
    }
  });
}
