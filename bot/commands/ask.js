import OpenAI from 'openai';

let client;
if (process.env.OPENAI_API_KEY) {
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export default function registerAsk(bot) {
  bot.command('ask', async (ctx) => {
    const question = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (!question) {
      return ctx.reply('Please provide a question. Usage: /ask <your question>');
    }
    if (!client) {
      return ctx.reply('AI not configured.');
    }
    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: question }]
      });
      const answer = completion.choices[0]?.message?.content?.trim();
      await ctx.reply(answer || 'No answer returned.');
    } catch (err) {
      console.error('AI error:', err);
      await ctx.reply('Sorry, I could not process that.');
    }
  });
}
