import { Router } from 'express';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import Message from '../models/Message.js';
import Post from '../models/Post.js';
import bot from '../bot.js';
import authenticate from '../middleware/auth.js';

const router = Router();

function assertTelegramMatch(req, res, telegramId) {
  if (!req.auth?.telegramId || req.auth.telegramId !== Number(telegramId)) {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}

router.use(authenticate);

router.post('/search', async (req, res) => {
  const { query, telegramId } = req.body;
  if (!query) return res.json([]);
  if (telegramId && !assertTelegramMatch(req, res, telegramId)) return;
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const regex = new RegExp(escapeRegExp(query), 'i');
  const filter = {
    $or: [
      { firstName: regex },
      { lastName: regex },
      { nickname: regex }
    ]
  };
  if (telegramId) {
    filter.telegramId = { $ne: Number(telegramId) };
  }
  const users = await User.find(filter)
    .limit(20)
    .select('telegramId firstName lastName nickname photo');
  res.json(users);
});

router.post('/request', async (req, res) => {
  const { fromId, toId } = req.body;
  if (!fromId || !toId) {
    return res.status(400).json({ error: 'fromId and toId required' });
  }
  if (!assertTelegramMatch(req, res, fromId)) return;
  const existing = await FriendRequest.findOne({ from: fromId, to: toId });
  if (existing) return res.json(existing);
  const reqDoc = await FriendRequest.create({ from: fromId, to: toId });
  try {
    await bot.telegram.sendMessage(
      String(toId),
      `You have a new friend request from ${fromId}`
    );
  } catch (err) {
    console.error('Failed to send Telegram notification:', err.message);
  }
  res.json(reqDoc);
});

router.post('/accept', async (req, res) => {
  const { requestId } = req.body;
  const fr = await FriendRequest.findById(requestId);
  if (!fr) return res.status(404).json({ error: 'request not found' });
  if (!assertTelegramMatch(req, res, fr.to)) return;
  if (fr.status !== 'pending') return res.json(fr);
  fr.status = 'accepted';
  await fr.save();
  await User.updateOne({ telegramId: fr.from }, { $addToSet: { friends: fr.to } });
  await User.updateOne({ telegramId: fr.to }, { $addToSet: { friends: fr.from } });
  try {
    await bot.telegram.sendMessage(
      String(fr.from),
      `Your friend request to ${fr.to} was accepted`
    );
  } catch (err) {
    console.error('Failed to send Telegram notification:', err.message);
  }
  res.json(fr);
});

router.post('/requests', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!assertTelegramMatch(req, res, telegramId)) return;
  const incoming = await FriendRequest.find({ to: telegramId, status: 'pending' });
  res.json(incoming);
});

router.post('/friends', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!assertTelegramMatch(req, res, telegramId)) return;
  const user = await User.findOne({ telegramId });
  if (!user) return res.json([]);
  const friends = await User.find({ telegramId: { $in: user.friends } })
    .select('telegramId firstName lastName nickname photo');
  res.json(friends);
});

router.post('/send-message', async (req, res) => {
  const { fromId, toId, text } = req.body;
  if (!fromId || !toId || !text)
    return res.status(400).json({ error: 'fromId, toId and text required' });
  if (!assertTelegramMatch(req, res, fromId)) return;
  const msg = await Message.create({ from: fromId, to: toId, text });
  try {
    await bot.telegram.sendMessage(
      String(toId),
      `New message from ${fromId}: ${text}`
    );
  } catch (err) {
    console.error('Failed to send Telegram notification:', err.message);
  }
  res.json(msg);
});


router.post('/messages', async (req, res) => {
  const { telegramId, withId } = req.body;
  if (!telegramId || !withId)
    return res.status(400).json({ error: 'telegramId and withId required' });
  if (!assertTelegramMatch(req, res, telegramId)) return;
  const msgs = await Message.find({
    $or: [
      { from: telegramId, to: withId },
      { from: withId, to: telegramId }
    ]
  })
    .sort({ createdAt: 1 })
    .limit(100);
  res.json(msgs);
});

router.post('/unread-count', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId)
    return res.status(400).json({ error: 'telegramId required' });
  if (!assertTelegramMatch(req, res, telegramId)) return;
  const user = await User.findOne({ telegramId });
  const since = user?.inboxReadAt || new Date(0);
  const count = await Message.countDocuments({ to: telegramId, createdAt: { $gt: since } });
  res.json({ count });
});

router.post('/mark-read', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId)
    return res.status(400).json({ error: 'telegramId required' });
  if (!assertTelegramMatch(req, res, telegramId)) return;
  await User.updateOne({ telegramId }, { inboxReadAt: new Date() });
  res.json({ success: true });
});

router.post('/wall/list', async (req, res) => {
  const { ownerId } = req.body;
  if (!ownerId) return res.status(400).json({ error: 'ownerId required' });
  if (!assertTelegramMatch(req, res, ownerId)) return;
  const posts = await Post.find({ owner: ownerId })
    .sort({ pinned: -1, createdAt: -1 })
    .limit(100);
  res.json(posts);
});

router.post('/wall/feed', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!assertTelegramMatch(req, res, telegramId)) return;
  const user = await User.findOne({ telegramId });
  const owners = [telegramId, ...(user?.friends || [])];
  const posts = await Post.find({ owner: { $in: owners } })
    .sort({ pinned: -1, createdAt: -1 })
    .limit(100);

  await Post.updateMany(
    { _id: { $in: posts.map((p) => p._id) }, owner: { $ne: telegramId } },
    { $inc: { views: 1 } }
  );
  res.json(posts);
});

router.post('/wall/post', async (req, res) => {
  const { ownerId, authorId, text, photo, photoAlt, tags, sharedPost } = req.body;
  if (!ownerId || !authorId)
    return res.status(400).json({ error: 'ownerId and authorId required' });
  if (!assertTelegramMatch(req, res, ownerId)) return;
  if (!assertTelegramMatch(req, res, authorId)) return;
  const post = await Post.create({
    owner: ownerId,
    author: authorId,
    text,
    photo,
    photoAlt,
    tags: tags || [],
    sharedPost
  });
  res.json(post);
});

router.post('/wall/like', async (req, res) => {
  const { postId, telegramId } = req.body;
  if (!postId || !telegramId)
    return res.status(400).json({ error: 'postId and telegramId required' });
  if (!assertTelegramMatch(req, res, telegramId)) return;
  const post = await Post.findByIdAndUpdate(
    postId,
    { $addToSet: { likes: telegramId } },
    { new: true }
  );
  if (post && telegramId !== post.owner) {
    try {
      await bot.telegram.sendMessage(
        String(post.owner),
        `Your post was liked by ${telegramId}`
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
  }
  res.json(post);
});

router.post('/wall/comment', async (req, res) => {
  const { postId, telegramId, text } = req.body;
  if (!postId || !telegramId || !text)
    return res
      .status(400)
      .json({ error: 'postId, telegramId and text required' });
  if (!assertTelegramMatch(req, res, telegramId)) return;
  const comment = { author: telegramId, text };
  const post = await Post.findByIdAndUpdate(
    postId,
    { $push: { comments: comment } },
    { new: true }
  );
  if (post && telegramId !== post.owner) {
    try {
      await bot.telegram.sendMessage(
        String(post.owner),
        `New comment on your post from ${telegramId}: ${text}`
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
  }
  res.json(post);
});

router.post('/wall/share', async (req, res) => {
  const { postId, telegramId } = req.body;
  if (!postId || !telegramId)
    return res.status(400).json({ error: 'postId and telegramId required' });
  if (!assertTelegramMatch(req, res, telegramId)) return;
  const original = await Post.findById(postId);
  if (!original) return res.status(404).json({ error: 'post not found' });
  const shared = await Post.create({
    owner: telegramId,
    author: telegramId,
    text: original.text,
    photo: original.photo,
    photoAlt: original.photoAlt,
    sharedPost: postId
  });
  res.json(shared);
});

router.post('/wall/react', async (req, res) => {
  const { postId, telegramId, emoji } = req.body;
  if (!postId || !telegramId || !emoji)
    return res
      .status(400)
      .json({ error: 'postId, telegramId and emoji required' });
  if (!assertTelegramMatch(req, res, telegramId)) return;
  const update = {};
  update[`reactions.${emoji}`] = telegramId;
  const post = await Post.findByIdAndUpdate(
    postId,
    { $addToSet: update },
    { new: true }
  );
  res.json(post);
});

router.post('/wall/trending', async (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.body.limit) || 20, 50));
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const posts = await Post.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $addFields: { likesCount: { $size: '$likes' } } },
    { $sort: { likesCount: -1, createdAt: -1 } },
    { $limit: limit }
  ]);
  res.json(posts);
});

router.post('/wall/pin', async (req, res) => {
  const { postId, telegramId, pinned } = req.body;
  if (!postId || !telegramId)
    return res.status(400).json({ error: 'postId and telegramId required' });
  if (!assertTelegramMatch(req, res, telegramId)) return;
  const post = await Post.findOne({ _id: postId, owner: telegramId });
  if (!post) return res.status(404).json({ error: 'post not found' });
  post.pinned = !!pinned;
  await post.save();
  res.json(post);
});

export default router;
