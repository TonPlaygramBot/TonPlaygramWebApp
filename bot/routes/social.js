import { Router } from 'express';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import Message from '../models/Message.js';
import Post from '../models/Post.js';
import bot from '../bot.js';
import authenticate from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

async function requireMatchingTelegram(req, res, telegramId) {
  const normalizedTelegramId = Number(telegramId);
  const telegramMatches =
    Number.isFinite(normalizedTelegramId) &&
    req.auth?.telegramId === normalizedTelegramId;
  let linkedAccountMatches = false;

  // Native and browser sessions may be authenticated with the persistent TPC
  // account or Google identity rather than Telegram init data. Those identities
  // are safe to use only after resolving the linked user on the server.
  if (!telegramMatches && Number.isFinite(normalizedTelegramId)) {
    if (req.auth?.accountId || req.auth?.googleId) {
      const linkedUser = await User.findOne({ telegramId: normalizedTelegramId })
        .select('accountId googleId')
        .lean();
      linkedAccountMatches = Boolean(
        (req.auth.accountId && linkedUser?.accountId === req.auth.accountId) ||
        (req.auth.googleId && linkedUser?.googleId === req.auth.googleId)
      );
    }
  }

  if (!telegramMatches && !linkedAccountMatches) {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}

router.post('/search', async (req, res) => {
  const { query, telegramId } = req.body;
  if (!query) return res.json([]);
  if (telegramId && !await requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!await requireMatchingTelegram(req, res, fromId)) return;
  const normalizedFromId = Number(fromId);
  const normalizedToId = Number(toId);
  if (!Number.isFinite(normalizedFromId) || !Number.isFinite(normalizedToId)) {
    return res.status(400).json({ error: 'invalid player id' });
  }
  if (normalizedFromId === normalizedToId) {
    return res.status(400).json({ error: 'you cannot add yourself' });
  }
  const recipientExists = await User.exists({ telegramId: normalizedToId });
  if (!recipientExists) return res.status(404).json({ error: 'player not found' });

  const alreadyFriends = await User.exists({
    telegramId: normalizedFromId,
    friends: normalizedToId
  });
  if (alreadyFriends) return res.status(409).json({ error: 'already friends' });

  // Reuse a previous rejected/accepted pair rather than failing against the
  // unique index, and make repeated taps on a pending request idempotent.
  const reqDoc = await FriendRequest.findOneAndUpdate(
    { from: normalizedFromId, to: normalizedToId },
    { $set: { status: 'pending', createdAt: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const sender = await User.findOne({ telegramId: Number(fromId) })
    .select('accountId firstName lastName nickname photo')
    .lean();
  const recipient = await User.findOne({ telegramId: Number(toId) }).select('accountId').lean();
  const sockets = req.app.get('userSockets');
  const io = req.app.get('io');
  const targets = new Set([
    ...(sockets?.get(String(toId)) || []),
    ...(recipient?.accountId ? sockets?.get(String(recipient.accountId)) || [] : [])
  ]);
  for (const socketId of targets) {
    io?.to(socketId).emit('friendRequest', {
      requestId: String(reqDoc._id),
      fromTelegramId: Number(fromId),
      fromAccountId: sender?.accountId,
      fromName: sender?.nickname || `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim() || String(fromId),
      fromPhoto: sender?.photo || ''
    });
  }
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
  if (!await requireMatchingTelegram(req, res, fr.to)) return;
  if (fr.status !== 'pending') return res.json(fr);
  fr.status = 'accepted';
  await fr.save();
  await User.updateOne({ telegramId: fr.from }, { $addToSet: { friends: fr.to } });
  await User.updateOne({ telegramId: fr.to }, { $addToSet: { friends: fr.from } });
  const sender = await User.findOne({ telegramId: fr.from }).select('accountId').lean();
  const recipient = await User.findOne({ telegramId: fr.to })
    .select('firstName lastName nickname')
    .lean();
  const sockets = req.app.get('userSockets');
  const io = req.app.get('io');
  const targets = new Set([
    ...(sockets?.get(String(fr.from)) || []),
    ...(sender?.accountId ? sockets?.get(String(sender.accountId)) || [] : [])
  ]);
  const acceptedBy = recipient?.nickname ||
    `${recipient?.firstName || ''} ${recipient?.lastName || ''}`.trim() ||
    String(fr.to);
  for (const socketId of targets) {
    io?.to(socketId).emit('friendRequestAccepted', {
      requestId: String(fr._id),
      byTelegramId: fr.to,
      byName: acceptedBy
    });
  }
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

router.post('/reject', async (req, res) => {
  const { requestId } = req.body;
  const fr = await FriendRequest.findById(requestId);
  if (!fr) return res.status(404).json({ error: 'request not found' });
  if (!await requireMatchingTelegram(req, res, fr.to)) return;
  if (fr.status === 'pending') {
    fr.status = 'rejected';
    await fr.save();
  }
  res.json(fr);
});

router.post('/requests', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
  const normalizedId = Number(telegramId);
  const requests = await FriendRequest.find({
    status: 'pending',
    $or: [{ to: normalizedId }, { from: normalizedId }]
  })
    .sort({ createdAt: -1 })
    .lean();
  const participantIds = [
    ...new Set(requests.flatMap((request) => [request.from, request.to]))
  ];
  const users = await User.find({ telegramId: { $in: participantIds } })
    .select('telegramId accountId firstName lastName nickname photo')
    .lean();
  const userById = new Map(users.map((user) => [Number(user.telegramId), user]));
  const response = requests.map((request) => {
    const fromUser = userById.get(Number(request.from));
    const toUser = userById.get(Number(request.to));
    const displayName = (user) =>
      user?.nickname ||
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
      '';
    return {
      ...request,
      requestId: String(request._id),
      fromId: request.from,
      toId: request.to,
      fromTelegramId: request.from,
      toTelegramId: request.to,
      fromAccountId: fromUser?.accountId,
      toAccountId: toUser?.accountId,
      fromName: displayName(fromUser),
      toName: displayName(toUser),
      fromPhoto: fromUser?.photo || '',
      toPhoto: toUser?.photo || ''
    };
  });
  res.json(response);
});

router.post('/friends', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!await requireMatchingTelegram(req, res, fromId)) return;
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
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
  const user = await User.findOne({ telegramId });
  const since = user?.inboxReadAt || new Date(0);
  const count = await Message.countDocuments({ to: telegramId, createdAt: { $gt: since } });
  res.json({ count });
});

router.post('/mark-read', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId)
    return res.status(400).json({ error: 'telegramId required' });
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
  await User.updateOne({ telegramId }, { inboxReadAt: new Date() });
  res.json({ success: true });
});

router.post('/wall/list', async (req, res) => {
  const { ownerId } = req.body;
  if (!ownerId) return res.status(400).json({ error: 'ownerId required' });
  if (!await requireMatchingTelegram(req, res, ownerId)) return;
  const posts = await Post.find({ owner: ownerId })
    .sort({ pinned: -1, createdAt: -1 })
    .limit(100);
  res.json(posts);
});

router.post('/wall/feed', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!await requireMatchingTelegram(req, res, ownerId)) return;
  if (!await requireMatchingTelegram(req, res, authorId)) return;
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
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
  const update = {};
  update[`reactions.${emoji}`] = telegramId;
  const post = await Post.findByIdAndUpdate(
    postId,
    { $addToSet: update },
    { new: true }
  );
  res.json(post);
});

router.post('/wall/update', async (req, res) => {
  const { postId, telegramId, text, tags, photo, photoAlt } = req.body;
  if (!postId || !telegramId)
    return res.status(400).json({ error: 'postId and telegramId required' });
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
  const updates = {};
  if (typeof text === 'string') updates.text = text;
  if (Array.isArray(tags)) updates.tags = tags;
  if (typeof photo === 'string') updates.photo = photo;
  if (typeof photoAlt === 'string') updates.photoAlt = photoAlt;
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'no updates provided' });
  const post = await Post.findOneAndUpdate(
    { _id: postId, owner: telegramId },
    { $set: updates },
    { new: true }
  );
  if (!post) return res.status(404).json({ error: 'post not found' });
  res.json(post);
});

router.post('/wall/delete', async (req, res) => {
  const { postId, telegramId } = req.body;
  if (!postId || !telegramId)
    return res.status(400).json({ error: 'postId and telegramId required' });
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
  const post = await Post.findOneAndDelete({ _id: postId, owner: telegramId });
  if (!post) return res.status(404).json({ error: 'post not found' });
  res.json({ success: true });
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
  if (!await requireMatchingTelegram(req, res, telegramId)) return;
  const post = await Post.findOne({ _id: postId, owner: telegramId });
  if (!post) return res.status(404).json({ error: 'post not found' });
  post.pinned = !!pinned;
  await post.save();
  res.json(post);
});

export default router;
