import { Router } from 'express';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { TASKS, TASKS_VERSION } from '../utils/tasksData.js';
import { ensureTransactionArray } from '../utils/userUtils.js';
import { TwitterApi } from 'twitter-api-v2';
import PostRecord from '../models/PostRecord.js';
import { similarityRatio, normalizeText } from '../utils/textSimilarity.js';
import { withProxy } from '../utils/proxyAgent.js';

const router = Router();
const twitterClient = process.env.TWITTER_BEARER_TOKEN
  ? new TwitterApi(process.env.TWITTER_BEARER_TOKEN)
  : null;

async function fetchReactionIds(messageId = '16', threadId = '1') {
  const base = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
  const url = new URL(`${base}/getMessageReactions`);
  url.searchParams.set('chat_id', '@TonPlaygram');
  url.searchParams.set('message_id', String(messageId));
  if (threadId) url.searchParams.set('message_thread_id', String(threadId));
  url.searchParams.set('limit', '200');
  const resp = await fetch(url, withProxy());
  const data = await resp.json();
  if (!data.ok) throw new Error(data.description || 'telegram api error');
  const reactions = data.result?.reactions || data.result || [];
  const ids = [];
  for (const r of reactions) {
    const id = r.user?.id ?? r.user_id ?? r.from?.id;
    if (typeof id === 'number') ids.push(id);
  }
  return ids;
}

function parseTelegramLink(link) {
  const m = link.match(/TonPlaygram\/(?:([0-9]+)\/)?([0-9]+)/);
  return {
    threadId: m && m[1] ? m[1] : undefined,
    messageId: m && m[2] ? m[2] : undefined,
  };
}

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

  if (taskId.startsWith('react_tg_post')) {
    if (process.env.BOT_TOKEN) {
      try {
        const { messageId, threadId } = parseTelegramLink(config.link || '');
        const ids = await fetchReactionIds(messageId, threadId);
        if (!ids.includes(Number(telegramId))) {
          return res.status(400).json({ error: 'reaction not verified' });
        }
      } catch (err) {
        console.error('telegram reaction verify failed:', err.message);
        return res.status(500).json({ error: 'verification failed' });
      }
    } else {
      console.warn('BOT_TOKEN not configured; skipping Telegram reaction check');
    }
  } else if (taskId === 'engage_tweet') {
    if (twitterClient) {
      const tweetId = extractTweetId(config.link || '');
      if (!tweetId) return res.status(500).json({ error: 'task misconfigured' });
      try {
        const [liked, retweeted, replied] = await Promise.all([
          didLike(telegramId, tweetId),
          didRetweet(telegramId, tweetId),
          didReply(telegramId, tweetId)
        ]);
        if (!liked || !retweeted || !replied) {
          return res.status(400).json({ error: 'engagement not verified' });
        }
      } catch (err) {
        console.error('engage tweet verify failed:', err.message);
        return res.status(500).json({ error: 'verification failed' });
      }
    } else {
      console.warn('TWITTER_BEARER_TOKEN not configured; skipping X engagement check');
    }
  }

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

router.post('/verify-telegram-reaction', async (req, res) => {
  const { telegramId, messageId, threadId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!process.env.BOT_TOKEN) {
    console.warn('BOT_TOKEN not configured; skipping Telegram reaction verification');
    return res.json({ reacted: false });
  }
  try {
    const ids = await fetchReactionIds(messageId, threadId);
    res.json({ reacted: ids.includes(Number(telegramId)) });
  } catch (err) {
    console.error('verify-telegram-reaction failed:', err.message);
    res.status(500).json({ error: 'verification failed' });
  }
});

async function getUserId(handle) {
  const info = await twitterClient.v2.userByUsername(handle);
  return info?.data?.id;
}

function extractTweetId(url) {
  return (url.match(/status\/(\d+)/) || [])[1];
}

async function didLike(telegramId, tweetId) {
  const user = await User.findOne({ telegramId });
  const handle = user?.social?.twitter;
  if (!handle) throw new Error('twitter handle not linked');
  const userId = await getUserId(handle);
  const resp = await twitterClient.v2.tweetLikedBy(tweetId);
  return Array.isArray(resp?.data) && resp.data.some((u) => u.id === userId);
}

async function didRetweet(telegramId, tweetId) {
  const user = await User.findOne({ telegramId });
  const handle = user?.social?.twitter;
  if (!handle) throw new Error('twitter handle not linked');
  const userId = await getUserId(handle);
  const resp = await twitterClient.v2.tweetRetweetedBy(tweetId);
  return Array.isArray(resp?.data) && resp.data.some((u) => u.id === userId);
}

async function didReply(telegramId, tweetId) {
  const user = await User.findOne({ telegramId });
  const handle = user?.social?.twitter;
  if (!handle) throw new Error('twitter handle not linked');
  const search = await twitterClient.v2.search(`conversation_id:${tweetId} from:${handle}`, { max_results: 10 });
  return Array.isArray(search?.data?.data) && search.data.data.length > 0;
}

router.post('/verify-like', async (req, res) => {
  const { telegramId, tweetUrl } = req.body;
  if (!telegramId || !tweetUrl) {
    return res.status(400).json({ error: 'telegramId and tweetUrl required' });
  }
  if (!twitterClient) {
    console.warn('TWITTER_BEARER_TOKEN not configured; skipping like verification');
    return res.json({ liked: false });
  }
  const tweetId = extractTweetId(tweetUrl);
  if (!tweetId) return res.status(400).json({ error: 'invalid tweet URL' });
  try {
    const liked = await didLike(telegramId, tweetId);
    res.json({ liked });
  } catch (err) {
    console.error('verify-like failed:', err.message);
    res.status(500).json({ error: 'verification failed' });
  }
});

router.post('/verify-retweet', async (req, res) => {
  const { telegramId, tweetUrl } = req.body;
  if (!telegramId || !tweetUrl) {
    return res.status(400).json({ error: 'telegramId and tweetUrl required' });
  }
  if (!twitterClient) {
    console.warn('TWITTER_BEARER_TOKEN not configured; skipping retweet verification');
    return res.json({ retweeted: false });
  }
  const tweetId = extractTweetId(tweetUrl);
  if (!tweetId) return res.status(400).json({ error: 'invalid tweet URL' });
  try {
    const retweeted = await didRetweet(telegramId, tweetId);
    res.json({ retweeted });
  } catch (err) {
    console.error('verify-retweet failed:', err.message);
    res.status(500).json({ error: 'verification failed' });
  }
});

router.post('/verify-reply', async (req, res) => {
  const { telegramId, tweetUrl } = req.body;
  if (!telegramId || !tweetUrl) {
    return res.status(400).json({ error: 'telegramId and tweetUrl required' });
  }
  if (!twitterClient) {
    console.warn('TWITTER_BEARER_TOKEN not configured; skipping reply verification');
    return res.json({ replied: false });
  }
  const tweetId = extractTweetId(tweetUrl);
  if (!tweetId) return res.status(400).json({ error: 'invalid tweet URL' });
  try {
    const replied = await didReply(telegramId, tweetId);
    res.json({ replied });
  } catch (err) {
    console.error('verify-reply failed:', err.message);
    res.status(500).json({ error: 'verification failed' });
  }
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
    console.warn('TWITTER_BEARER_TOKEN not configured; skipping post verification');
    await PostRecord.create({ telegramId, tweetId: 'unknown' });
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
    return res.json({ message: 'verified', reward: config.reward });
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
