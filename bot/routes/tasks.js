import { Router } from 'express';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { TASKS } from '../utils/tasksData.js';
import { ensureTransactionArray } from '../utils/userUtils.js';
import { TwitterApi } from 'twitter-api-v2';

const router = Router();
const twitterClient = process.env.TWITTER_BEARER_TOKEN
  ? new TwitterApi(process.env.TWITTER_BEARER_TOKEN)
  : null;

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

router.post('/verify-retweet', async (req, res) => {
  const { telegramId, tweetUrl } = req.body;
  if (!telegramId || !tweetUrl) {
    return res.status(400).json({ error: 'telegramId and tweetUrl required' });
  }

  const config = TASKS.find((t) => t.id === 'retweet_post');
  if (!config) return res.status(500).json({ error: 'task not configured' });

  const existing = await Task.findOne({ telegramId, taskId: 'retweet_post' });
  if (existing) return res.json({ message: 'already completed' });

  if (!twitterClient) {
    return res.status(500).json({ error: 'Twitter API not configured' });
  }

  const targetId = (config.link.match(/status\/(\d+)/) || [])[1];
  const providedId = (tweetUrl.match(/status\/(\d+)/) || [])[1];
  if (!targetId || !providedId) {
    return res.status(400).json({ error: 'invalid tweet URL' });
  }

  try {
    const tweet = await twitterClient.v2.singleTweet(providedId, {
      expansions: ['author_id', 'referenced_tweets.id'],
      'tweet.fields': ['author_id', 'referenced_tweets']
    });

    const author = await twitterClient.v2.user(tweet.data.author_id);
    const user = await User.findOne({ telegramId });
    const linked = user?.social?.twitter?.replace(/^@/, '');
    if (!linked || author.data.username.toLowerCase() !== linked.toLowerCase()) {
      return res.status(400).json({ error: 'twitter handle mismatch' });
    }

    let valid = false;
    if (tweet.data.referenced_tweets) {
      valid = tweet.data.referenced_tweets.some((r) => r.id === targetId);
    }
    if (!valid) {
      const [likes, rts] = await Promise.all([
        twitterClient.v2.tweetLikedBy(targetId, { asPaginator: false }),
        twitterClient.v2.tweetRetweetedBy(targetId, { asPaginator: false })
      ]);
      const uid = tweet.data.author_id;
      const liked = likes.data?.some((u) => u.id === uid);
      const retweeted = rts.data?.some((u) => u.id === uid);
      valid = liked || retweeted;
    }

    if (!valid) {
      return res.status(400).json({ error: 'retweet/like/comment not found' });
    }

    await Task.create({ telegramId, taskId: 'retweet_post', completedAt: new Date() });
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
    console.error('verify-retweet failed:', err.message);
    res.status(500).json({ error: 'verification failed' });
  }
});

export default router;
