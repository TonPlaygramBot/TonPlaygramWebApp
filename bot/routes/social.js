import { Router } from 'express';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import Message from '../models/Message.js';
import Post from '../models/Post.js';
import bot from '../bot.js';
import authenticate from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

function authCanUseIdentity(auth, identity) {
  const value = String(identity ?? '');
  return Boolean(
    auth?.apiToken ||
    (auth?.telegramId != null && value === String(auth.telegramId)) ||
    (auth?.accountId && value === String(auth.accountId))
  );
}

function requireMatchingTelegram(req, res, telegramId) {
  if (!authCanUseIdentity(req.auth, telegramId)) {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}

function userIdentity(user) {
  return user?.telegramId ?? user?.accountId;
}

function userIdentityFilter(identity) {
  const value = String(identity ?? '');
  const numeric = Number(value);
  return { $or: [
    { accountId: value },
    ...(Number.isFinite(numeric) ? [{ telegramId: numeric }] : [])
  ] };
}

function findSocialUser(identity, selection = '') {
  const query = User.findOne(userIdentityFilter(identity));
  return selection ? query.select(selection) : query;
}

router.post('/search', async (req, res) => {
  const { query, telegramId } = req.body;
  if (!query) return res.json([]);
  if (telegramId && !requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!requireMatchingTelegram(req, res, fromId)) return;
  const senderUser = await findSocialUser(fromId, 'telegramId accountId firstName lastName nickname photo friends');
  const recipientUser = await findSocialUser(toId, 'telegramId accountId');
  if (!senderUser || !recipientUser) return res.status(404).json({ error: 'player not found' });
  const normalizedFromId = userIdentity(senderUser);
  const normalizedToId = userIdentity(recipientUser);
  if (String(normalizedFromId) === String(normalizedToId)) {
    return res.status(400).json({ error: 'you cannot add yourself' });
  }
  const alreadyFriends = senderUser.friends?.some((id) => String(id) === String(normalizedToId));
  if (alreadyFriends) return res.status(409).json({ error: 'already friends' });

  // Reuse a previous rejected/accepted pair rather than failing against the
  // unique index, and make repeated taps on a pending request idempotent.
  const reqDoc = await FriendRequest.findOneAndUpdate(
    { from: normalizedFromId, to: normalizedToId },
    { $set: { status: 'pending', createdAt: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const sender = senderUser.toObject();
  const recipient = recipientUser.toObject();
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
    if (recipient.telegramId) await bot.telegram.sendMessage(
      String(recipient.telegramId),
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
  if (!requireMatchingTelegram(req, res, fr.to)) return;
  if (fr.status !== 'pending') return res.json(fr);
  fr.status = 'accepted';
  await fr.save();
  await User.updateOne(userIdentityFilter(fr.from), { $addToSet: { friends: fr.to } });
  await User.updateOne(userIdentityFilter(fr.to), { $addToSet: { friends: fr.from } });
  const sender = await findSocialUser(fr.from, 'accountId telegramId').lean();
  const recipient = await findSocialUser(fr.to, 'telegramId firstName lastName nickname')
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
    if (sender?.telegramId) await bot.telegram.sendMessage(
      String(sender.telegramId),
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
  if (!requireMatchingTelegram(req, res, fr.to)) return;
  if (fr.status === 'pending') {
    fr.status = 'rejected';
    await fr.save();
  }
  res.json(fr);
});

router.post('/requests', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!requireMatchingTelegram(req, res, telegramId)) return;
  const currentUser = await findSocialUser(telegramId, 'telegramId accountId');
  if (!currentUser) return res.json([]);
  const normalizedId = userIdentity(currentUser);
  const requests = await FriendRequest.find({
    status: 'pending',
    $or: [{ to: normalizedId }, { from: normalizedId }]
  })
    .sort({ createdAt: -1 })
    .lean();
  const participantIds = [
    ...new Set(requests.flatMap((request) => [request.from, request.to]))
  ];
  const users = await User.find({ $or: [{ telegramId: { $in: participantIds } }, { accountId: { $in: participantIds.map(String) } }] })
    .select('telegramId accountId firstName lastName nickname photo')
    .lean();
  const userById = new Map(users.flatMap((user) => [user.telegramId != null ? [String(user.telegramId), user] : null, user.accountId ? [String(user.accountId), user] : null].filter(Boolean)));
  const response = requests.map((request) => {
    const fromUser = userById.get(String(request.from));
    const toUser = userById.get(String(request.to));
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
  if (!requireMatchingTelegram(req, res, telegramId)) return;
  const user = await findSocialUser(telegramId);
  if (!user) return res.json([]);
  const friendIds = user.friends || [];
  const numericIds = friendIds.map(Number).filter(Number.isFinite);
  const friends = await User.find({ $or: [{ telegramId: { $in: numericIds } }, { accountId: { $in: friendIds.map(String) } }] })
    .select('telegramId accountId firstName lastName nickname photo');
  res.json(friends.map((friend) => ({ ...friend.toObject(), socialId: userIdentity(friend) })));
});

router.post('/send-message', async (req, res) => {
  const { fromId, toId, text } = req.body;
  if (!fromId || !toId || !text)
    return res.status(400).json({ error: 'fromId, toId and text required' });
  if (!requireMatchingTelegram(req, res, fromId)) return;
  const sender = await findSocialUser(fromId, 'telegramId accountId firstName lastName nickname');
  const recipient = await findSocialUser(toId, 'telegramId accountId');
  if (!sender || !recipient) return res.status(404).json({ error: 'player not found' });
  const senderId = userIdentity(sender);
  const recipientId = userIdentity(recipient);
  const msg = await Message.create({ from: senderId, to: recipientId, text: String(text).trim().slice(0, 2000) });
  const sockets = req.app.get('userSockets');
  const io = req.app.get('io');
  const targets = new Set([...(sockets?.get(String(recipientId)) || []), ...(recipient.accountId ? sockets?.get(String(recipient.accountId)) || [] : [])]);
  for (const socketId of targets) io?.to(socketId).emit('privateMessage', msg.toObject());
  try {
    if (recipient.telegramId) await bot.telegram.sendMessage(
      String(recipient.telegramId),
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
  if (!requireMatchingTelegram(req, res, telegramId)) return;
  const self = await findSocialUser(telegramId, 'telegramId accountId');
  const peer = await findSocialUser(withId, 'telegramId accountId');
  if (!self || !peer) return res.json([]);
  const selfId = userIdentity(self);
  const peerId = userIdentity(peer);
  const msgs = await Message.find({
    $or: [
      { from: selfId, to: peerId },
      { from: peerId, to: selfId }
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
  if (!requireMatchingTelegram(req, res, telegramId)) return;
  const user = await findSocialUser(telegramId);
  const since = user?.inboxReadAt || new Date(0);
  const count = await Message.countDocuments({ to: userIdentity(user), createdAt: { $gt: since } });
  res.json({ count });
});

router.post('/mark-read', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId)
    return res.status(400).json({ error: 'telegramId required' });
  if (!requireMatchingTelegram(req, res, telegramId)) return;
  await User.updateOne(userIdentityFilter(telegramId), { inboxReadAt: new Date() });
  res.json({ success: true });
});

router.post('/wall/list', async (req, res) => {
  const { ownerId } = req.body;
  if (!ownerId) return res.status(400).json({ error: 'ownerId required' });
  if (!requireMatchingTelegram(req, res, ownerId)) return;
  const posts = await Post.find({ owner: ownerId })
    .sort({ pinned: -1, createdAt: -1 })
    .limit(100);
  res.json(posts);
});

router.post('/wall/feed', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  if (!requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!requireMatchingTelegram(req, res, ownerId)) return;
  if (!requireMatchingTelegram(req, res, authorId)) return;
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
  if (!requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!requireMatchingTelegram(req, res, telegramId)) return;
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
  if (!requireMatchingTelegram(req, res, telegramId)) return;
  const post = await Post.findOne({ _id: postId, owner: telegramId });
  if (!post) return res.status(404).json({ error: 'post not found' });
  post.pinned = !!pinned;
  await post.save();
  res.json(post);
});

export default router;
