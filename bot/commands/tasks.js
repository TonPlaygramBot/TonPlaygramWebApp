import Task from '../models/Task.js';
import User from '../models/User.js';
import { TASKS } from '../utils/tasksData.js';

export default function registerTasks(bot) {
  bot.command('tasks', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    const action = parts[1];
    const telegramId = ctx.from.id;

    if (action === 'complete' && parts[2]) {
      const taskId = parts[2];
      const config = TASKS.find(t => t.id === taskId);
      if (!config) return ctx.reply('Unknown task.');

      const existing = await Task.findOne({ telegramId, taskId });
      if (existing) return ctx.reply('Task already completed.');

      await Task.create({ telegramId, taskId, completedAt: new Date() });
      const user = await User.findOneAndUpdate({ telegramId }, {}, { upsert: true, new: true });
      user.minedTPC += config.reward;
      await user.save();
      return ctx.reply(`Task completed! You earned ${config.reward} TPC.`);
    }

    const tasks = await Promise.all(TASKS.map(async t => {
      const rec = await Task.findOne({ telegramId, taskId: t.id });
      return { ...t, completed: !!rec };
    }));

    let msg = 'Tasks:\n';
    tasks.forEach(t => {
      msg += `- ${t.description} - ` + (t.completed ? '✅' : `/tasks complete ${t.id}`) + '\n';
    });
    ctx.reply(msg);
  });
}
