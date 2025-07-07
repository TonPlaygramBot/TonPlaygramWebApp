import { Router } from 'express';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import Message from '../models/Message.js';
import Post from '../models/Post.js';
import bot from '../bot.js';
import { ensureTransactionArray } from '../utils/userUtils.js';
import GIFTS from '../utils/gifts.js';

const router = Router();

router.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.json([]);
  const regex = new RegExp(query, 'i');
  const users = await User.find({
    $or: [
      { firstName: regex },
      { lastName: regex },
      { nickname: regex }
    ]
  })
    .limit(20)
    .select('telegramId firstName lastName nickname photo');
  res.json(users);
});

router.post('/request', async (req, res) => {
  const { fromId, toId } = req.body;
  if (!fromId || !toId) {
    return res.status(400).json({ error: 'fromId and toId required' });
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

router.post('/accept', async (req, res) => {
  const { requestId } = req.body;
  const fr = await FriendRequest.findById(requestId);
  if (!fr) return res.status(404).json({ error: 'request not found' });
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
  const incoming = await FriendRequest.find({ to: telegramId, status: 'pending' });
  res.json(incoming);
});

router.post('/friends', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
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

router.post('/send-gift', async (req, res) => {
  const { fromId, toId, gift } = req.body;
  if (!fromId || !toId || !gift) {
    return res.status(400).json({ error: 'fromId, toId and gift required' });
  }
  const g = GIFTS.find((x) => x.id === gift);
  if (!g) return res.status(400).json({ error: 'invalid gift' });

  const sender = await User.findOne({ telegramId: fromId });
  if (!sender || sender.balance < g.price) {
    return res.status(400).json({ error: 'insufficient balance' });
  }
  let receiver = await User.findOne({ telegramId: toId });
  if (!receiver) receiver = new User({ telegramId: toId });

  const devAccount = process.env.DEV_ACCOUNT_ID || process.env.VITE_DEV_ACCOUNT_ID;
  let devUser = null;
  if (devAccount) {
    devUser = await User.findOne({ accountId: devAccount });
    if (!devUser) devUser = new User({ accountId: devAccount });
    ensureTransactionArray(devUser);
  }

  ensureTransactionArray(sender);
  ensureTransactionArray(receiver);

  const devShare = Math.round(g.price * 0.1);
  const recvAmount = g.price - devShare;
  sender.balance -= g.price;
  receiver.balance += recvAmount;
  if (devUser) devUser.balance = (devUser.balance || 0) + devShare;

  const txDate = new Date();
  sender.transactions.push({
    amount: -g.price,
    type: 'gift',
    token: 'TPC',
    date: txDate,
    toAccount: String(toId),
    detail: gift,
  });
  receiver.transactions.push({
    amount: recvAmount,
    type: 'gift-receive',
    token: 'TPC',
    date: txDate,
    fromAccount: String(fromId),
    detail: gift,
  });
  if (devUser) {
    devUser.transactions.push({
      amount: devShare,
      type: 'gift-fee',
      token: 'TPC',
      date: txDate,
      fromAccount: String(fromId),
    });
  }

  await sender.save();
  await receiver.save();
  if (devUser) await devUser.save();

  try {
    await bot.telegram.sendMessage(
      String(toId),
      `\u{1FA99} You received ${recvAmount} TPC as a gift`
    );
  } catch (err) {
    console.error('Failed to send Telegram notification:', err.message);
  }

  res.json({ balance: sender.balance });
});

router.post('/messages', async (req, res) => {
  const { telegramId, withId } = req.body;
  if (!telegramId || !withId)
    return res.status(400).json({ error: 'telegramId and withId required' });
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

router.post('/wall/list', async (req, res) => {
  const { ownerId } = req.body;
  if (!ownerId) return res.status(400).json({ error: 'ownerId required' });
  const posts = await Post.find({ owner: ownerId })
    .sort({ pinned: -1, createdAt: -1 })
    .limit(100);
  res.json(posts);
});

router.post('/wall/feed', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
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
  const post = await Post.findOne({ _id: postId, owner: telegramId });
  if (!post) return res.status(404).json({ error: 'post not found' });
  post.pinned = !!pinned;
  await post.save();
  res.json(post);
});

export default router;
