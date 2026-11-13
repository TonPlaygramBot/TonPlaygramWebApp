import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';
import { STARTER_WEAPONS } from '../../webapp/src/games/tiranastreets/shared/weapons.mjs';
import { WEAPON_STORE_BY_ID, WEAPON_STORE_CATALOG } from '../../webapp/src/games/tiranastreets/weaponStoreCatalog.mjs';

const router = Router();
router.use(authenticate);

function identity(auth = {}) {
  if (auth.telegramId) return { telegramId: auth.telegramId };
  if (auth.googleId) return { googleId: auth.googleId };
  if (auth.accountId) return { accountId: auth.accountId };
  return null;
}

export function validatePurchase(body = {}) {
  const item = WEAPON_STORE_BY_ID.get(String(body.itemId || ''));
  if (!item?.available || STARTER_WEAPONS.includes(item.weaponId)) return { error: 'Weapon unavailable or included in starter equipment.', code: 'INVALID_ITEM' };
  const key = String(body.idempotencyKey || '');
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(key)) return { error: 'Invalid purchase request.', code: 'INVALID_REQUEST' };
  return { item, transactionId: `tirana-weapon:${key}` };
}

const accountPayload = (user) => ({
  balanceTPG: Number(user.balance || 0),
  ownedWeaponIds: [...new Set([...STARTER_WEAPONS, ...(user.tiranaStreetsInventory?.weapons || [])])]
});

router.get('/catalog', (_req, res) => res.json({ items: WEAPON_STORE_CATALOG }));
router.get('/account', async (req, res, next) => {
  try {
  const query = identity(req.auth);
  if (!query) return res.status(401).json({ error: 'Unauthorized.' });
  const user = await User.findOne(query).select('balance tiranaStreetsInventory').lean();
  if (!user) return res.status(404).json({ error: 'TPG account not found.' });
  res.json(accountPayload(user));
  } catch (error) { next(error); }
});

export const createPurchaseHandler = (Model) => async (req, res, next) => {
  try {
    const query = identity(req.auth);
    if (!query) return res.status(401).json({ error: 'Unauthorized.' });
    const checked = validatePurchase(req.body);
    if (checked.error) return res.status(400).json(checked);
    const { item, transactionId } = checked;
    const replay = (user) => {
      const receipt = user?.transactions?.find(t => t.transactionId === transactionId);
      if (!receipt) return false;
      if (receipt.detail !== item.id || receipt.type !== 'tirana_weapon_purchase') {
        res.status(409).json({error:'This purchase reference belongs to a different item.',code:'IDEMPOTENCY_CONFLICT'});
      } else res.json({...accountPayload(user),weaponId:item.weaponId,transactionId});
      return true;
    };
    const existing = await Model.findOne({ ...query, 'transactions.transactionId': transactionId });
    if (replay(existing)) return;
    // A single conditional document update atomically checks funds, prevents
    // duplicate ownership, debits TPG and delivers the unlock.
    const user = await Model.findOneAndUpdate(
      { ...query, balance: { $gte: item.priceTPG }, 'tiranaStreetsInventory.weapons': { $ne: item.weaponId }, 'transactions.transactionId': {$ne:transactionId} },
      {
        $inc: { balance: -item.priceTPG },
        $addToSet: { 'tiranaStreetsInventory.weapons': item.weaponId },
        $push: { transactions: { transactionId, amount: -item.priceTPG, type: 'tirana_weapon_purchase', token: 'TPG', status: 'delivered', game: 'tiranastreets', detail: item.id } }
      },
      { new: true }
    );
    if (!user) {
      const current = await Model.findOne(query);
      if (replay(current)) return;
      if (!current) return res.status(404).json({ error: 'TPG account not found.', code: 'ACCOUNT_NOT_FOUND' });
      if ((current.tiranaStreetsInventory?.weapons || []).includes(item.weaponId))
        return res.status(409).json({ error: 'Weapon already owned.', code: 'ALREADY_OWNED', ...accountPayload(current) });
      return res.status(402).json({ error: 'Insufficient TPG balance.', code: 'INSUFFICIENT_TPG', ...accountPayload(current) });
    }
    res.status(201).json({ ...accountPayload(user), weaponId: item.weaponId, transactionId });
  } catch (error) { next(error); }
};
router.post('/purchase', createPurchaseHandler(User));

export default router;
