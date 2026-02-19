import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';
import BurnedTPC from '../models/BurnedTPC.js';
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

function normalizeTxHash(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function resolvePayment({ user, accountId, totalPrice, txHash }) {
  const normalizedTxHash = normalizeTxHash(txHash);
  ensureTransactionArray(user);

  if (normalizedTxHash) {
    const alreadyClaimed = (user.transactions || []).some(
      (tx) => normalizeTxHash(tx?.txHash) === normalizedTxHash
    );
    if (alreadyClaimed) {
      return { error: 'payment already claimed', status: 409 };
    }

    const confirmedTransfer = await BurnedTPC.findOne({
      txHash: normalizedTxHash,
      verified: true,
      recipient: accountId
    });

    if (!confirmedTransfer) {
      return {
        error: 'payment not confirmed yet. Wait for network confirmation and retry.',
        status: 409
      };
    }

    if (confirmedTransfer.claimedByAccountId && confirmedTransfer.claimedByAccountId !== accountId) {
      return { error: 'payment already claimed', status: 409 };
    }

    const paidAmount = Number(confirmedTransfer.amount) || 0;
    if (paidAmount < totalPrice) {
      return { error: 'confirmed payment amount is below item total', status: 400 };
    }

    confirmedTransfer.claimedByAccountId = accountId;
    confirmedTransfer.claimedAt = new Date();
    await confirmedTransfer.save();

    return {
      kind: 'confirmed-transfer',
      txHash: normalizedTxHash,
      paymentToken: 'TPC',
      balance: resolveUserBalance(user)
    };
  }

  const balance = resolveUserBalance(user);
  if (balance < totalPrice) {
    return { error: 'insufficient balance', status: 400 };
  }

  return {
    kind: 'balance',
    paymentToken: 'TPC',
    balance
  };
}

router.post('/purchase', authenticate, async (req, res) => {
  const { accountId, bundle, txHash } = req.body;
  const authId = req.auth?.telegramId;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
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

  const payment = await resolvePayment({ user, accountId, totalPrice, txHash });
  if (payment.error) {
    return res.status(payment.status || 400).json({ error: payment.error });
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
    token: payment.paymentToken,
    status: 'delivered',
    date: txDate,
    detail: 'Storefront purchase',
    txHash: payment.txHash || undefined,
    items
  });
  if (payment.kind === 'balance') {
    user.balance = payment.balance - totalPrice;
  }
  await user.save();

  return res.json({
    balance: user.balance,
    date: txDate,
    paymentToken: payment.paymentToken,
    txHash: payment.txHash || undefined
  });
});

export { resolvePayment };
export default router;
