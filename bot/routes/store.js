import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';
import { ensureTransactionArray, calculateBalance } from '../utils/userUtils.js';
import { applyVoiceCommentaryUnlocks } from './voiceCommentary.js';
import { getVoiceCatalog } from '../utils/voiceCommentaryCatalog.js';

const router = Router();


export const BUNDLES = {};

function safeNumericBalance(value) {
  return Number.isFinite(value) ? value : 0;
}

function resolveUserBalance(user) {
  const derived = safeNumericBalance(calculateBalance(user));
  const persisted = safeNumericBalance(Number(user?.balance));
  return Math.max(derived, persisted);
}

router.post('/purchase', authenticate, async (req, res) => {
  const { accountId, bundle, txHash } = req.body;
  const authId = req.auth?.telegramId;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  if (txHash) {
    return res.status(400).json({ error: 'TON payments are disabled. Use TPC balance only.' });
  }

  const isItemBundle =
    bundle &&
    typeof bundle === 'object' &&
    !Array.isArray(bundle) &&
    Array.isArray(bundle.items);

  if (!isItemBundle) {
    return res.status(400).json({ error: 'items bundle required' });
  }

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  if (authId && user.telegramId && authId !== user.telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const rawItems = bundle.items.filter(Boolean);
  if (!rawItems.length) {
    return res.status(400).json({ error: 'items required' });
  }

  const items = rawItems.map((item) => ({
    slug: item.slug,
    type: item.type,
    optionId: item.optionId,
    price: Number(item.price) || 0
  }));

  const totalPrice = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  if (!Number.isFinite(totalPrice) || totalPrice < 0) {
    return res.status(400).json({ error: 'invalid bundle total' });
  }

  ensureTransactionArray(user);
  const balance = resolveUserBalance(user);
  if (balance < totalPrice) {
    return res.status(400).json({ error: 'insufficient balance' });
  }

  const txDate = new Date();
  const hasVoiceItem = items.some((item) => item.type === 'voiceLanguage');
  if (hasVoiceItem) {
    const catalog = await getVoiceCatalog();
    applyVoiceCommentaryUnlocks(user, items, catalog.voices || []);
  }

  user.transactions.push({
    amount: -totalPrice,
    type: 'storefront',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    detail: 'Storefront purchase',
    items
  });
  user.balance = balance - totalPrice;
  await user.save();

  return res.json({
    balance: user.balance,
    date: txDate,
    paymentToken: 'TPC'
  });
});

export default router;
