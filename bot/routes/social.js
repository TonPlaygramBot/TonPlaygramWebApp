import { Router } from 'express';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import Message from '../models/Message.js';

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
  res.json(msg);
});

router.post('/messages', async (req, res) => {
  const { userId, withId } = req.body;
  if (!userId || !withId)
    return res.status(400).json({ error: 'userId and withId required' });
  const msgs = await Message.find({
    $or: [
      { from: userId, to: withId },
      { from: withId, to: userId }
    ]
  })
    .sort({ createdAt: 1 })
    .limit(100);
  res.json(msgs);
});

export default router;
