import { Router } from 'express';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import Message from '../models/Message.js';
import Post from '../models/Post.js';
import bot from '../bot.js';
import authenticate from '../middleware/auth.js';

const router = Router();

function ensureSelf(req, id) {
  if (!id) return true;
  return req.auth?.telegramId === Number(id);
}

router.post('/search', authenticate, async (req, res) => {
  const { query, telegramId } = req.body;
  if (!query) return res.json([]);
  if (telegramId && !ensureSelf(req, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
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

router.post('/request', authenticate, async (req, res) => {
  const { fromId, toId } = req.body;
  if (!fromId || !toId) {
    return res.status(400).json({ error: 'fromId and toId required' });
  }
  if (!ensureSelf(req, fromId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
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

router.post('/accept', authenticate, async (req, res) => {
  const { requestId } = req.body;
  const fr = await FriendRequest.findById(requestId);
  if (!fr) return res.status(404).json({ error: 'request not found' });
  if (fr.status !== 'pending') return res.json(fr);
  if (!ensureSelf(req, fr.to)) {
    return res.status(403).json({ error: 'forbidden' });
  }
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

router.post('/requests', authenticate, async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!ensureSelf(req, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const incoming = await FriendRequest.find({ to: telegramId, status: 'pending' });
  res.json(incoming);
});

router.post('/friends', authenticate, async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!ensureSelf(req, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const user = await User.findOne({ telegramId });
  if (!user) return res.json([]);
  const friends = await User.find({ telegramId: { $in: user.friends } })
    .select('telegramId firstName lastName nickname photo');
  res.json(friends);
});

router.post('/send-message', authenticate, async (req, res) => {
  const { fromId, toId, text } = req.body;
  if (!fromId || !toId || !text)
    return res.status(400).json({ error: 'fromId, toId and text required' });
  if (!ensureSelf(req, fromId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
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


router.post('/messages', authenticate, async (req, res) => {
  const { telegramId, withId } = req.body;
  if (!telegramId || !withId)
    return res.status(400).json({ error: 'telegramId and withId required' });
  if (!ensureSelf(req, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
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

router.post('/unread-count', authenticate, async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId)
    return res.status(400).json({ error: 'telegramId required' });
  if (!ensureSelf(req, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const user = await User.findOne({ telegramId });
  const since = user?.inboxReadAt || new Date(0);
  const count = await Message.countDocuments({ to: telegramId, createdAt: { $gt: since } });
  res.json({ count });
});

router.post('/mark-read', authenticate, async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId)
    return res.status(400).json({ error: 'telegramId required' });
  if (!ensureSelf(req, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  await User.updateOne({ telegramId }, { inboxReadAt: new Date() });
  res.json({ success: true });
});

router.post('/wall/list', authenticate, async (req, res) => {
  const { ownerId } = req.body;
  if (!ownerId) return res.status(400).json({ error: 'ownerId required' });
  if (!ensureSelf(req, ownerId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const posts = await Post.find({ owner: ownerId })
    .sort({ pinned: -1, createdAt: -1 })
    .limit(100);
  res.json(posts);
});

router.post('/wall/feed', authenticate, async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!ensureSelf(req, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
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

router.post('/wall/post', authenticate, async (req, res) => {
  const { ownerId, authorId, text, photo, photoAlt, tags, sharedPost } = req.body;
  if (!ownerId || !authorId)
    return res.status(400).json({ error: 'ownerId and authorId required' });
  if (!ensureSelf(req, ownerId) || !ensureSelf(req, authorId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
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

router.post('/wall/like', authenticate, async (req, res) => {
  const { postId, telegramId } = req.body;
  if (!postId || !telegramId)
    return res.status(400).json({ error: 'postId and telegramId required' });
  if (!ensureSelf(req, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
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

router.post('/wall/comment', authenticate, async (req, res) => {
  const { postId, telegramId, text } = req.body;
  if (!postId || !telegramId || !text)
    return res
      .status(400)
      .json({ error: 'postId, telegramId and text required' });
  if (!ensureSelf(req, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
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

router.post('/wall/share', authenticate, async (req, res) => {
  const { postId, telegramId } = req.body;
  if (!postId || !telegramId)
    return res.status(400).json({ error: 'postId and telegramId required' });
  if (!ensureSelf(req, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
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

router.post('/wall/react', authenticate, async (req, res) => {
  const { postId, telegramId, emoji } = req.body;
  if (!postId || !telegramId || !emoji)
    return res
      .status(400)
      .json({ error: 'postId, telegramId and emoji required' });
  if (!ensureSelf(req, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const update = {};
  update[`reactions.${emoji}`] = telegramId;
  const post = await Post.findByIdAndUpdate(
    postId,
    { $addToSet: update },
    { new: true }
  );
  res.json(post);
});

router.post('/wall/trending', authenticate, async (req, res) => {
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

router.post('/wall/pin', authenticate, async (req, res) => {
  const { postId, telegramId, pinned } = req.body;
  if (!postId || !telegramId)
    return res.status(400).json({ error: 'postId and telegramId required' });
  if (!ensureSelf(req, telegramId)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const post = await Post.findOne({ _id: postId, owner: telegramId });
  if (!post) return res.status(404).json({ error: 'post not found' });
  post.pinned = !!pinned;
  await post.save();
  res.json(post);
});

export default router;
