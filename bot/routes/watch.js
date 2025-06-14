import { Router } from 'express';
import { VIDEOS } from '../utils/watchData.js';
import WatchRecord from '../models/WatchRecord.js';
import User from '../models/User.js';

const router = Router();

router.post('/list', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const records = await WatchRecord.find({ telegramId });
  const videos = VIDEOS.map(v => ({
    ...v,
    watched: records.some(r => r.videoId === v.id)
  }));
  res.json(videos);
});

router.post('/watch', async (req, res) => {
  const { telegramId, videoId } = req.body;
  if (!telegramId || !videoId) return res.status(400).json({ error: 'telegramId and videoId required' });

  const video = VIDEOS.find(v => v.id === videoId);
  if (!video) return res.status(400).json({ error: 'unknown video' });

  const existing = await WatchRecord.findOne({ telegramId, videoId });
  if (existing) return res.json({ message: 'already watched' });

  await WatchRecord.create({ telegramId, videoId });
  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true }
  );
  user.balance += video.reward;
  user.transactions.push({
    amount: video.reward,
    type: 'watch',
    status: 'delivered',
    date: new Date()
  });
  await user.save();

  res.json({ message: 'watched', reward: video.reward });
});

export default router;
