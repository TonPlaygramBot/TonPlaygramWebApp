import { Router } from 'express';
import User from '../models/User.js';
import { POOL_ROYALE_DEFAULT_UNLOCKS } from '../../webapp/src/config/poolRoyaleInventoryConfig.js';
import {
  findMemoryUser,
  saveMemoryUser,
  shouldUseMemoryUserStore
} from '../utils/memoryUserStore.js';

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

async function handleInventoryGet(accountId, res) {
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  let user;
  try {
    if (shouldUseMemoryUserStore()) {
      user = findMemoryUser({ accountId });
    } else {
      user = await User.findOne({ accountId });
    }
  } catch (err) {
    console.error('Pool Royale inventory lookup failed:', err.message);
    return res.status(500).json({ error: 'failed to load inventory' });
  }
  if (!user) return res.status(404).json({ error: 'account not found' });

  const normalized = normalizeInventory(user.poolRoyalInventory);
  if (!areInventoriesEqual(user.poolRoyalInventory, normalized)) {
    user.poolRoyalInventory = normalized;
    try {
      if (shouldUseMemoryUserStore()) {
        saveMemoryUser(user);
      } else {
        await user.save();
      }
    } catch (err) {
      console.error('Failed to normalize Pool Royale inventory:', err.message);
    }
  }
  res.json({ accountId, inventory: normalized });
}

async function handleInventorySet(accountId, inventory, res) {
  if (!accountId) return res.status(400).json({ error: 'accountId required' });

  let user;
  try {
    if (shouldUseMemoryUserStore()) {
      user = findMemoryUser({ accountId });
    } else {
      user = await User.findOne({ accountId });
    }
  } catch (err) {
    console.error('Pool Royale inventory lookup failed:', err.message);
    return res.status(500).json({ error: 'failed to load inventory' });
  }
  if (!user) return res.status(404).json({ error: 'account not found' });

  const merged = mergeInventories(user.poolRoyalInventory, inventory);
  user.poolRoyalInventory = merged;
  try {
    if (shouldUseMemoryUserStore()) {
      saveMemoryUser(user);
    } else {
      await user.save();
    }
  } catch (err) {
    console.error('Failed to persist Pool Royale inventory:', err.message);
    return res.status(500).json({ error: 'failed to save inventory' });
  }
  res.json({ accountId, inventory: merged });
}

router.get('/inventory/:accountId', async (req, res) => {
  const { accountId } = req.params || {};
  return handleInventoryGet(accountId, res);
});

router.post('/inventory/get', async (req, res) => {
  const { accountId } = req.body || {};
  return handleInventoryGet(accountId, res);
});

router.put('/inventory/:accountId', async (req, res) => {
  const { accountId } = req.params || {};
  const { inventory } = req.body || {};
  return handleInventorySet(accountId, inventory, res);
});

router.post('/inventory/set', async (req, res) => {
  const { accountId, inventory } = req.body || {};
  return handleInventorySet(accountId, inventory, res);
});

export default router;
