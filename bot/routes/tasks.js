import { Router } from 'express';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { TASKS, TASKS_VERSION } from '../utils/tasksData.js';
import { ensureTransactionArray } from '../utils/userUtils.js';
import { TwitterApi } from 'twitter-api-v2';
import PostRecord from '../models/PostRecord.js';
import { similarityRatio, normalizeText } from '../utils/textSimilarity.js';

const router = Router();
const twitterClient = process.env.TWITTER_BEARER_TOKEN
  ? new TwitterApi(process.env.TWITTER_BEARER_TOKEN)
  : null;

router.post('/list', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

  const tasks = await Promise.all(
    TASKS.map(async (t) => {
      const rec = await Task.findOne({ telegramId, taskId: t.id });
      return { ...t, completed: !!rec };
    })
  );
  res.json({ version: TASKS_VERSION, tasks });
});

router.post('/complete', async (req, res) => {
  const { telegramId, taskId } = req.body;
  if (!telegramId || !taskId) return res.status(400).json({ error: 'telegramId and taskId required' });

  const config = TASKS.find(t => t.id === taskId);
  if (!config) return res.status(400).json({ error: 'unknown task' });

  const existing = await Task.findOne({ telegramId, taskId });
  if (existing) return res.json({ message: 'already completed' });

  await Task.create({ telegramId, taskId, completedAt: new Date() });
  const user = await User.findOneAndUpdate(
    { telegramId },
    { $setOnInsert: { referralCode: telegramId.toString() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  ensureTransactionArray(user);
  user.minedTPC += config.reward;
  user.transactions.push({
    amount: config.reward,
    type: 'task',
    status: 'pending',
    date: new Date()
  });
  await user.save();

  res.json({ message: 'completed', reward: config.reward });
});

router.post('/verify-post', async (req, res) => {
  const { telegramId, tweetUrl } = req.body;
  if (!telegramId || !tweetUrl) {
    return res.status(400).json({ error: 'telegramId and tweetUrl required' });
  }

  const config = TASKS.find((t) => t.id === 'post_tweet');
  if (!config) return res.status(500).json({ error: 'task not configured' });

  const last = await PostRecord.findOne({ telegramId }).sort({ postedAt: -1 });
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  if (last && Date.now() - last.postedAt.getTime() < TWELVE_HOURS) {
    return res.status(400).json({ error: 'cooldown active' });
  }

  if (!twitterClient) {
    return res
      .status(500)
      .json({
        error:
          'Twitter API not configured. Set TWITTER_BEARER_TOKEN in bot/.env',
      });
  }

  const providedId = (tweetUrl.match(/status\/(\d+)/) || [])[1];
  if (!providedId) {
    return res.status(400).json({ error: 'invalid tweet URL' });
  }

  try {
    const tweet = await twitterClient.v2.singleTweet(providedId, {
      'tweet.fields': ['text']
    });

    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'user not found' });
    }

    const text = normalizeText(tweet.data.text);
    const highest = Math.max(
      ...config.posts.map((p) => {
        const norm = normalizeText(p);
        return similarityRatio(text, norm);
      })
    );
    if (highest < 0.85) {
      return res.status(400).json({ error: 'tweet text does not match' });
    }

    await PostRecord.create({ telegramId, tweetId: providedId });
    ensureTransactionArray(user);
    user.minedTPC += config.reward;
    user.transactions.push({
      amount: config.reward,
      type: 'task',
      status: 'pending',
      date: new Date()
    });
    await user.save();

    res.json({ message: 'verified', reward: config.reward });
  } catch (err) {
    console.error('verify-post failed:', err.message);
    res.status(500).json({ error: 'verification failed' });
  }
});

export default router;
