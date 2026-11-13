import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import { POOL_ROYALE_DEFAULT_UNLOCKS } from '../../webapp/src/config/poolRoyaleInventoryConfig.js';
import { SNOOKER_ROYALE_DEFAULT_UNLOCKS } from '../../webapp/src/config/snookerRoyalInventoryConfig.js';
import { AIR_HOCKEY_DEFAULT_UNLOCKS } from '../../webapp/src/config/airHockeyInventoryConfig.js';

const router = Router();


export const BUNDLES = {};

const STORE_INVENTORY_TARGETS = {
  poolroyale: 'pool',
  snookerroyale: 'snooker',
  airhockey: 'airHockey'
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
  const airHockeyInventory = normalizeInventory(user.airHockeyInventory, AIR_HOCKEY_DEFAULT_UNLOCKS);
  const delivery = {
    pool: [],
    snooker: [],
    airHockey: [],
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

    if (target === 'snooker') {
      const current = new Set(snookerInventory[item.type] || []);
      const sizeBefore = current.size;
      current.add(item.optionId);
      snookerInventory[item.type] = [...current];
      if (current.size !== sizeBefore) delivery.snooker.push(item);
      return;
    }

    const current = new Set(airHockeyInventory[item.type] || []);
    const sizeBefore = current.size;
    current.add(item.optionId);
    airHockeyInventory[item.type] = [...current];
    if (current.size !== sizeBefore) delivery.airHockey.push(item);
  });

  user.poolRoyalInventory = poolInventory;
  user.snookerRoyalInventory = snookerInventory;
  user.airHockeyInventory = airHockeyInventory;

  return {
    ...delivery,
    poolInventory,
    snookerInventory,
    airHockeyInventory
  };
}

// Client-supplied item prices and non-atomic delivery are not a settlement
// authority. Keep both aliases closed until catalog pricing, idempotent debit,
// and inventory delivery are enforced together on the server.
function rejectUnverifiedPurchase(_req, res) {
  return res.status(403).json({ error: 'verified_settlement_required' });
}
router.post('/purchase-v2', authenticate, rejectUnverifiedPurchase);
router.post('/purchase', authenticate, rejectUnverifiedPurchase);

export default router;
