import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';
import { ensureTransactionArray } from '../utils/userUtils.js';
import { withProxy } from '../utils/proxyAgent.js';
import TonWeb from 'tonweb';

const router = Router();

const STORE_ADDRESS = process.env.STORE_DEPOSIT_ADDRESS ||
  'UQDqDBiNU132j15Qka5EmSf37jCTLF-RdOlaQOXLHIJ5t-XT';

function normalize(addr) {
  try {
    return new TonWeb.utils.Address(addr).toString(true, false, false);
  } catch {
    return null;
  }
}

const STORE_ADDRESS_NORM = normalize(STORE_ADDRESS);

const BOOST_EXPIRY = new Date('2025-08-21T00:00:00Z');

const BUNDLES = {
  newbie: { tpc: 25000, ton: 0.25, label: 'Newbie Pack', supply: 500000 },
  rookie: { tpc: 50000, ton: 0.4, label: 'Rookie', supply: 1000000 },
  starter: { tpc: 100000, ton: 0.75, label: 'Starter', supply: 2000000 },
  miner: { tpc: 250000, ton: 1.6, label: 'Miner Pack', boost: 0.03, supply: 5000000 },
  grinder: { tpc: 500000, ton: 3.0, label: 'Grinder', boost: 0.05, supply: 7500000 },
  pro: { tpc: 1000000, ton: 5.5, label: 'Pro Bundle', boost: 0.08, supply: 10000000 },
  whale: { tpc: 2500000, ton: 10.5, label: 'Whale Bundle', boost: 0.12, supply: 12500000 },
  max: { tpc: 5000000, ton: 20, label: 'Max Presale', boost: 0.15, supply: 15000000 },
};

router.post('/purchase', authenticate, async (req, res) => {
  const { accountId, txHash, bundle } = req.body;
  const authId = req.auth?.telegramId;
  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }
  let pack = BUNDLES[bundle];
  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });
  if (authId && user.telegramId && authId !== user.telegramId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  if (txHash) {
    const existing = user.transactions.find(t => t.txHash === txHash);
    if (existing) {
      return res.json({ alreadyClaimed: true, date: existing.date });
    }
    try {
      const resp = await fetch(
        `https://tonapi.io/v2/blockchain/transactions/${txHash}`,
        withProxy()
      );
      if (!resp.ok) {
        return res.status(400).json({ error: 'transaction not found' });
      }
      const data = await resp.json();
      const out = (data.out_msgs || []).find(m => normalize(m.destination?.address) === STORE_ADDRESS_NORM);
      if (!out) return res.status(400).json({ error: 'destination mismatch' });
      const tonVal = Number(out.value) / 1e9;
      if (!pack) {
        pack = Object.values(BUNDLES).find(b => Math.abs(b.ton - tonVal) < 1e-6);
        if (!pack) return res.status(400).json({ error: 'amount mismatch' });
      } else if (Math.abs(tonVal - pack.ton) > 1e-6) {
        return res.status(400).json({ error: 'amount mismatch' });
      }
      const sender = normalize(data.in_msg?.source?.address || '');
      if (user.walletAddress && sender && normalize(user.walletAddress) !== sender) {
        return res.status(400).json({ error: 'sender mismatch' });
      }
    } catch (err) {
      console.error('Failed to verify tx:', err.message);
      return res.status(500).json({ error: 'verification failed' });
    }
  } else if (!pack) {
    return res.status(400).json({ error: 'bundle required' });
  }

  ensureTransactionArray(user);
  const txDate = new Date();
  user.balance += pack.tpc;
  if (pack.boost) {
    if (!user.storeMiningExpiresAt || user.storeMiningExpiresAt < BOOST_EXPIRY) {
      user.storeMiningExpiresAt = BOOST_EXPIRY;
    }
    if ((user.storeMiningRate || 0) < pack.boost) {
      user.storeMiningRate = pack.boost;
    }
  }
  user.transactions.push({
    amount: pack.tpc,
    type: 'store',
    token: 'TPC',
    status: 'delivered',
    date: txDate,
    detail: pack.label,
    txHash
  });
  await user.save();
  res.json({
    balance: user.balance,
    date: txDate,
    storeMiningRate: user.storeMiningRate || 0,
    storeMiningExpiresAt: user.storeMiningExpiresAt,
  });
});

export default router;
