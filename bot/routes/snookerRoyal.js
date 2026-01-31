import { Router } from 'express';
import User from '../models/User.js';
import { SNOOKER_ROYALE_DEFAULT_UNLOCKS } from '../../webapp/src/config/snookerRoyalInventoryConfig.js';
import {
  findMemoryUser,
  saveMemoryUser,
  shouldUseMemoryUserStore
} from '../utils/memoryUserStore.js';
import authenticate from '../middleware/auth.js';

const router = Router();

const copyDefaults = () =>
  Object.entries(SNOOKER_ROYALE_DEFAULT_UNLOCKS).reduce((acc, [key, values]) => {
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

async function getAuthorizedUser(req, accountId, res) {
  if (!accountId) {
    res.status(400).json({ error: 'accountId required' });
    return null;
  }

  let user;
  try {
    if (shouldUseMemoryUserStore()) {
      user = findMemoryUser({ accountId });
    } else {
      user = await User.findOne({ accountId });
    }
  } catch (err) {
    console.error('Snooker Royal inventory lookup failed:', err.message);
    res.status(500).json({ error: 'failed to load inventory' });
    return null;
  }
  if (!user) {
    res.status(404).json({ error: 'account not found' });
    return null;
  }

  if (user.telegramId && !req.auth?.apiToken && req.auth?.telegramId !== user.telegramId) {
    res.status(403).json({ error: 'forbidden' });
    return null;
  }

  return user;
}

async function handleInventoryGet(req, accountId, res) {
  const user = await getAuthorizedUser(req, accountId, res);
  if (!user) return;

  const normalized = normalizeInventory(user.snookerRoyalInventory);
  if (!areInventoriesEqual(user.snookerRoyalInventory, normalized)) {
    user.snookerRoyalInventory = normalized;
    try {
      if (shouldUseMemoryUserStore()) {
        saveMemoryUser(user);
      } else {
        await user.save();
      }
    } catch (err) {
      console.error('Failed to normalize Snooker Royal inventory:', err.message);
    }
  }
  res.json({ accountId, inventory: normalized });
}

async function handleInventorySet(req, accountId, inventory, res) {
  const user = await getAuthorizedUser(req, accountId, res);
  if (!user) return;

  const merged = mergeInventories(user.snookerRoyalInventory, inventory);
  user.snookerRoyalInventory = merged;
  try {
    if (shouldUseMemoryUserStore()) {
      saveMemoryUser(user);
    } else {
      await user.save();
    }
  } catch (err) {
    console.error('Failed to persist Snooker Royal inventory:', err.message);
    return res.status(500).json({ error: 'failed to save inventory' });
  }
  res.json({ accountId, inventory: merged });
}

router.use(authenticate);

router.get('/inventory/:accountId', async (req, res) => {
  const { accountId } = req.params || {};
  return handleInventoryGet(req, accountId, res);
});

router.post('/inventory/get', async (req, res) => {
  const { accountId } = req.body || {};
  return handleInventoryGet(req, accountId, res);
});

router.put('/inventory/:accountId', async (req, res) => {
  const { accountId } = req.params || {};
  const { inventory } = req.body || {};
  return handleInventorySet(req, accountId, inventory, res);
});

router.post('/inventory/set', async (req, res) => {
  const { accountId, inventory } = req.body || {};
  return handleInventorySet(req, accountId, inventory, res);
});

export default router;
