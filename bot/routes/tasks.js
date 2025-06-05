import { Router } from 'express';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { TASKS } from '../utils/tasksData.js';

const router = Router();

router.post('/list', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const tasks = await Promise.all(TASKS.map(async t => {
    const rec = await Task.findOne({ telegramId, taskId: t.id });
    return { ...t, completed: !!rec };
  }));
  res.json(tasks);
});

router.post('/complete', async (req, res) => {
  const { telegramId, taskId } = req.body;
  if (!telegramId || !taskId) return res.status(400).json({ error: 'telegramId and taskId required' });

  const config = TASKS.find(t => t.id === taskId);
  if (!config) return res.status(400).json({ error: 'unknown task' });

  const existing = await Task.findOne({ telegramId, taskId });
  if (existing) return res.json({ message: 'already completed' });

  await Task.create({ telegramId, taskId, completedAt: new Date() });
  const user = await User.findOneAndUpdate({ telegramId }, {}, { upsert: true, new: true });
  user.minedTPC += config.reward;
  await user.save();

  res.json({ message: 'completed', reward: config.reward });
});

export default router;
