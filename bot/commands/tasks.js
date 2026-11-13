import Task from '../models/Task.js';
import { TASKS } from '../utils/tasksData.js';

export default function registerTasks(bot) {
  bot.command('tasks', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    const action = parts[1];
    const telegramId = ctx.from.id;

    if (action === 'complete') {
      return ctx.reply('Task rewards are unavailable until verified settlement is enabled.');
    }

    const tasks = await Promise.all(TASKS.map(async t => {
      const rec = await Task.findOne({ telegramId, taskId: t.id });
      return { ...t, completed: !!rec };
    }));

    let msg = 'Tasks:\n';
    tasks.forEach(t => {
      msg += `- ${t.description} - ` + (t.completed ? '✅' : 'Reward settlement paused') + '\n';
    });
    ctx.reply(msg);
  });
}
