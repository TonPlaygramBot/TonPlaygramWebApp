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

const BUNDLES = {
  '10k': { tpc: 10000, ton: 0.012, label: '10k TPC' },
  '100k': { tpc: 100000, ton: 0.05, label: '100k TPC' },
  '250k': { tpc: 250000, ton: 0.1, label: '250k TPC' }
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
  res.json({ balance: user.balance, date: txDate });
});

export default router;
