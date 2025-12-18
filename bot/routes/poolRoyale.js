import { Router } from 'express';
import User from '../models/User.js';
import { POOL_ROYALE_DEFAULT_UNLOCKS } from '../../webapp/src/config/poolRoyaleInventoryConfig.js';

const router = Router();

const copyDefaults = () =>
  Object.entries(POOL_ROYALE_DEFAULT_UNLOCKS).reduce((acc, [key, values]) => {
    acc[key] = Array.isArray(values) ? [...values] : [];
    return acc;
  }, {});

const sortUnique = (values) => Array.from(new Set(values)).filter(Boolean).sort();

const normalizeInventory = (rawInventory) => {
  const base = copyDefaults();
  if (!rawInventory || typeof rawInventory !== 'object') return base;
  const merged = { ...base };
  Object.entries(rawInventory).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    merged[key] = sortUnique([...(merged[key] || []), ...value]);
  });
  return merged;
};

const mergeInventories = (...inventories) => {
  const merged = copyDefaults();
  inventories
    .filter(Boolean)
    .forEach((inventory) => {
      const normalized = normalizeInventory(inventory);
      Object.entries(normalized).forEach(([key, values]) => {
        if (!Array.isArray(values)) return;
        merged[key] = sortUnique([...(merged[key] || []), ...values]);
      });
    });
  return merged;
};

const areInventoriesEqual = (a, b) => {
  const aKeys = Object.keys(a || {});
  const bKeys = Object.keys(b || {});
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) => Array.isArray(a[key]) && Array.isArray(b?.[key]) && a[key].join('|') === b[key].join('|')
  );
};

router.post('/inventory/get', async (req, res) => {
  const { accountId } = req.body || {};
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });

  const normalized = normalizeInventory(user.poolRoyalInventory);
  if (!areInventoriesEqual(user.poolRoyalInventory, normalized)) {
    user.poolRoyalInventory = normalized;
    try {
      await user.save();
    } catch (err) {
      console.error('Failed to normalize Pool Royale inventory:', err.message);
    }
  }
  res.json({ accountId, inventory: normalized });
});

router.post('/inventory/set', async (req, res) => {
  const { accountId, inventory } = req.body || {};
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });

  const merged = mergeInventories(user.poolRoyalInventory, inventory);
  user.poolRoyalInventory = merged;
  try {
    await user.save();
  } catch (err) {
    console.error('Failed to persist Pool Royale inventory:', err.message);
    return res.status(500).json({ error: 'failed to save inventory' });
  }
  res.json({ accountId, inventory: merged });
});

export default router;
