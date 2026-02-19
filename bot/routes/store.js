import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';
import { ensureTransactionArray, calculateBalance } from '../utils/userUtils.js';
import { applyVoiceCommentaryUnlocks } from './voiceCommentary.js';
import { getVoiceCatalog } from '../utils/voiceCommentaryCatalog.js';
import {
  findMemoryUser,
  saveMemoryUser,
  shouldUseMemoryUserStore
} from '../utils/memoryUserStore.js';
import { POOL_ROYALE_DEFAULT_UNLOCKS } from '../../webapp/src/config/poolRoyaleInventoryConfig.js';
import { SNOOKER_ROYALE_DEFAULT_UNLOCKS } from '../../webapp/src/config/snookerRoyalInventoryConfig.js';

const router = Router();


export const BUNDLES = {};

const STORE_INVENTORY_TARGETS = {
  poolroyale: 'pool',
  tabletennisroyal: 'pool',
  snookerroyale: 'snooker'
};

function copyDefaults(defaults = {}) {
  return Object.entries(defaults).reduce((acc, [key, values]) => {
    acc[key] = Array.isArray(values) ? [...new Set(values.filter(Boolean))] : [];
    return acc;
  }, {});
}

function normalizeInventory(rawInventory, defaults) {
  const normalized = copyDefaults(defaults);
  if (!rawInventory || typeof rawInventory !== 'object') return normalized;
  Object.entries(rawInventory).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    normalized[key] = [...new Set([...(normalized[key] || []), ...value.filter(Boolean)])];
  });
  return normalized;
}

export function applyStoreItemDelivery(user, items = []) {
  const poolInventory = normalizeInventory(user.poolRoyalInventory, POOL_ROYALE_DEFAULT_UNLOCKS);
  const snookerInventory = normalizeInventory(user.snookerRoyalInventory, SNOOKER_ROYALE_DEFAULT_UNLOCKS);
  const delivery = {
    pool: [],
    snooker: [],
    unsupported: []
  };

  items.forEach((item) => {
    const target = STORE_INVENTORY_TARGETS[item.slug];
    if (!target || !item.type || !item.optionId) {
      delivery.unsupported.push(item);
      return;
    }

    if (target === 'pool') {
      const current = new Set(poolInventory[item.type] || []);
      const sizeBefore = current.size;
      current.add(item.optionId);
      poolInventory[item.type] = [...current];
      if (current.size !== sizeBefore) delivery.pool.push(item);
      return;
    }

    const current = new Set(snookerInventory[item.type] || []);
    const sizeBefore = current.size;
    current.add(item.optionId);
    snookerInventory[item.type] = [...current];
    if (current.size !== sizeBefore) delivery.snooker.push(item);
  });

  user.poolRoyalInventory = poolInventory;
  user.snookerRoyalInventory = snookerInventory;

  return {
    ...delivery,
    poolInventory,
    snookerInventory
  };
}

function safeNumericBalance(value) {
  return Number.isFinite(value) ? value : 0;
}

function resolveUserBalance(user) {
  const derived = safeNumericBalance(calculateBalance(user));
  const persisted = safeNumericBalance(Number(user?.balance));
  return Math.max(derived, persisted);
}

function isPrivileged(req) {
  return req.auth?.apiToken === true;
}

function canAccessUser(req, user) {
  if (isPrivileged(req)) return true;
  if (!user) return false;
  if (user.telegramId && req.auth?.telegramId && user.telegramId === req.auth.telegramId) return true;
  if (user.googleId && req.auth?.googleId && user.googleId === req.auth.googleId) return true;
  if (user.accountId && req.auth?.accountId && user.accountId === req.auth.accountId) return true;
  return !user.telegramId && !user.googleId;
}

export async function handleTpcPurchase(req, res) {
  const { accountId, bundle, txHash } = req.body;
  const useMemoryStore = shouldUseMemoryUserStore();
  const findUser = async (query) =>
    useMemoryStore ? findMemoryUser(query) : User.findOne(query);
  const persistUser = async (user) =>
    useMemoryStore ? saveMemoryUser(user) : user.save();

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

  const user = await findUser({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  if (!canAccessUser(req, user)) {
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

  const delivery = applyStoreItemDelivery(user, items);

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
  await persistUser(user);

  return res.json({
    balance: user.balance,
    date: txDate,
    paymentToken: 'TPC',
    delivery: {
      pool: delivery.pool.length,
      snooker: delivery.snooker.length,
      unsupported: delivery.unsupported.length
    }
  });
}

router.post('/purchase-v2', authenticate, handleTpcPurchase);

// Legacy route kept as a compatibility alias while clients migrate.
router.post('/purchase', authenticate, handleTpcPurchase);

export default router;
