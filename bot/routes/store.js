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

function daysFromNow(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export const BUNDLES = {
  newbie: { tpc: 50000, ton: 0.2, label: 'Newbie Pack' },
  rookie: { tpc: 100000, ton: 0.35, label: 'Rookie' },
  starter: { tpc: 200000, ton: 0.6, label: 'Starter' },
  miner: { tpc: 400000, ton: 1.2, label: 'Miner Pack', boost: 0.03 },
  grinder: { tpc: 750000, ton: 2.0, label: 'Grinder', boost: 0.05 },
  pro: { tpc: 1500000, ton: 3.8, label: 'Pro Bundle', boost: 0.08 },
  whale: { tpc: 4000000, ton: 9.0, label: 'Whale Bundle', boost: 0.12 },
  max: { tpc: 8000000, ton: 18.0, label: 'Max Presale', boost: 0.15 },

  // Spin & Win Bundles
  luckyStarter: { tpc: 6000, ton: 0.15, label: 'Lucky Starter' },
  spinx3: { tpc: 12000, ton: 0.25, label: 'Spin x3 Pack' },
  megaSpin: { tpc: 30000, ton: 0.7, label: 'Mega Spin Pack' },

  // Virtual Friends
  lazyLarry: { tpc: 0, ton: 0.1, label: 'Lazy Larry', boost: 0.25, duration: 7 },
  smartSia: { tpc: 0, ton: 0.2, label: 'Smart Sia', boost: 0.5, duration: 7 },
  grindBot: { tpc: 0, ton: 0.5, label: 'GrindBot3000', boost: 1.25, duration: 14 },

  // Bonus Bundles
  powerPack: { tpc: 10000, ton: 0.25, label: 'Power Pack', boost: 0.5, duration: 3 },
  proPack: { tpc: 25000, ton: 0.4, label: 'Pro Pack', boost: 0.5, duration: 7 },
  galaxyPack: { tpc: 60000, ton: 1.0, label: 'Galaxy Pack', boost: 1.25, duration: 7 },
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
    const expiry = pack.duration ? daysFromNow(pack.duration) : BOOST_EXPIRY;
    if (!user.storeMiningExpiresAt || user.storeMiningExpiresAt < expiry) {
      user.storeMiningExpiresAt = expiry;
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
