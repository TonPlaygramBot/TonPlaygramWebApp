import { Router } from 'express';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { TASKS, TASKS_VERSION } from '../utils/tasksData.js';
import { ensureTransactionArray } from '../utils/userUtils.js';
import { TwitterApi } from 'twitter-api-v2';
import PostRecord from '../models/PostRecord.js';
import { similarityRatio, normalizeText } from '../utils/textSimilarity.js';
import { withProxy } from '../utils/proxyAgent.js';
import CustomTask from '../models/CustomTask.js';

const router = Router();
const twitterClient = process.env.TWITTER_BEARER_TOKEN
  ? new TwitterApi(process.env.TWITTER_BEARER_TOKEN)
  : null;

const PLATFORM_ICONS = {
  tiktok: 'tiktok',
  x: 'x',
  telegram: 'telegram',
  discord: 'discord',
  youtube: 'youtube',
  facebook: 'facebook',
  instagram: 'instagram'
};

async function fetchReactionIds(messageId = '16', threadId = '1') {
  try {
    const base = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
    const url = new URL(`${base}/getMessageReactions`);
    url.searchParams.set('chat_id', '@TonPlaygram');
    url.searchParams.set('message_id', String(messageId));
    if (threadId) url.searchParams.set('message_thread_id', String(threadId));
    url.searchParams.set('limit', '200');
    const resp = await fetch(url, withProxy());
    const data = await resp.json();
    if (!data.ok) {
      console.warn('getMessageReactions failed:', data.description);
      return [];
    }
    const reactions = data.result?.reactions || data.result || [];
    const ids = [];
    for (const r of reactions) {
      const id = r.user?.id ?? r.user_id ?? r.from?.id;
      if (typeof id === 'number') ids.push(id);
    }
    return ids;
  } catch (err) {
    console.error('fetchReactionIds error:', err.message);
    return [];
  }
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

  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  const baseTasks = await Promise.all(
    TASKS.map(async (t) => {
      if (t.id === 'post_tweet') {
        const last = await PostRecord.findOne({ telegramId }).sort({ postedAt: -1 });
        if (last) {
          const diff = Date.now() - last.postedAt.getTime();
          if (diff < TWELVE_HOURS) {
            return { ...t, completed: true, cooldown: TWELVE_HOURS - diff };
          }
        }
        return { ...t, completed: false, cooldown: 0 };
      }
      const rec = await Task.findOne({ telegramId, taskId: t.id });
      return { ...t, completed: !!rec, cooldown: 0 };
    })
  );

  const customList = await CustomTask.find().lean();
  const customTasks = await Promise.all(
    customList.map(async (t) => {
      const taskId = `custom_${t._id}`;
      const rec = await Task.findOne({ telegramId, taskId });
      return {
        id: taskId,
        description: t.description || `Task on ${t.platform}`,
        reward: t.reward,
        icon: PLATFORM_ICONS[t.platform] || t.platform,
        link: t.link,
        completed: !!rec,
        cooldown: 0
      };
    })
  );

  res.json({ version: TASKS_VERSION, tasks: [...baseTasks, ...customTasks] });
});

router.post('/complete', async (req, res) => {
  const { telegramId, taskId } = req.body;
  if (!telegramId || !taskId) return res.status(400).json({ error: 'telegramId and taskId required' });

  let config = TASKS.find(t => t.id === taskId);
  if (!config && taskId.startsWith('custom_')) {
    const id = taskId.replace('custom_', '');
    const custom = await CustomTask.findById(id);
    if (custom) config = { reward: custom.reward };
  }
  if (!config) return res.status(400).json({ error: 'unknown task' });

  if (taskId === 'post_tweet') {
    return res.status(400).json({ error: 'use verify-post' });
  }

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

function isAuthorized(req) {
  const auth = req.headers.authorization || '';
  return (
    process.env.API_AUTH_TOKEN && auth === `Bearer ${process.env.API_AUTH_TOKEN}`
  );
}

router.post('/admin/list', async (req, res) => {
  if (!isAuthorized(req)) return res.status(403).json({ error: 'unauthorized' });
  const tasks = await CustomTask.find().lean();
  res.json(tasks);
});

router.post('/admin/create', async (req, res) => {
  if (!isAuthorized(req)) return res.status(403).json({ error: 'unauthorized' });
  const { platform, reward, link, description } = req.body;
  if (!platform || !reward || !link) {
    return res
      .status(400)
      .json({ error: 'platform, reward and link required' });
  }
  const task = await CustomTask.create({ platform, reward, link, description });
  res.json(task);
});

router.post('/admin/update', async (req, res) => {
  if (!isAuthorized(req)) return res.status(403).json({ error: 'unauthorized' });
  const { id, platform, reward, link, description } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  const task = await CustomTask.findByIdAndUpdate(
    id,
    { platform, reward, link, description },
    { new: true }
  );
  if (!task) return res.status(404).json({ error: 'not found' });
  res.json(task);
});

router.post('/admin/delete', async (req, res) => {
  if (!isAuthorized(req)) return res.status(403).json({ error: 'unauthorized' });
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  await CustomTask.findByIdAndDelete(id);
  res.json({ success: true });
});

export default router;
