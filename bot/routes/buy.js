import { Router } from 'express';

import {
  MAX_TPC_PER_WALLET,
  PURCHASE_INTERVAL_MS,
  INITIAL_PRICE,
  PRICE_INCREASE_STEP,
  PRESALE_ROUNDS,
} from '../config.js';
import PresaleState from '../models/PresaleState.js';
import User from '../models/User.js';
import WalletPurchase from '../models/WalletPurchase.js';
import { ensureTransactionArray } from '../utils/userUtils.js';
import { withProxy } from '../utils/proxyAgent.js';
import TonWeb from 'tonweb';

const router = Router();
const STORE_ADDRESS = process.env.STORE_DEPOSIT_ADDRESS ||
  'UQAPwsGyKzA4MuBnCflTVwEcTLcGS9yV6okJWQGzO5VxVYD1';

function normalize(addr) {
  try {
    return new TonWeb.utils.Address(addr).toString(true, false, false);
  } catch {
    return null;
  }
}

const STORE_ADDRESS_NORM = normalize(STORE_ADDRESS);

const STATE_ID = 'singleton';
let state = null;

async function loadState() {
  if (!state) {
    state = await PresaleState.findById(STATE_ID);
    if (!state) {
      state = new PresaleState({
        _id: STATE_ID,
        currentRound: 1,
        tokensSold: 0,
        tonRaised: 0,
        currentPrice: INITIAL_PRICE,
      });
      await state.save();
    }
  }
  return state;
}

async function saveState() {
  if (state) await state.save();
}

router.get('/status', async (_req, res) => {
  const st = await loadState();
  const round = PRESALE_ROUNDS[st.currentRound - 1] || {};
  const remaining = round.maxTokens ? round.maxTokens - st.tokensSold : 0;
  res.json({
    currentPrice: st.currentPrice,
    currentRound: st.currentRound,
    remainingTokens: remaining,
    maxPerWallet: MAX_TPC_PER_WALLET,
    tonRaised: st.tonRaised,
  });
});

router.post('/', async (req, res) => {
  await loadState();
  const { wallet, amountTON } = req.body;
  if (!wallet || typeof amountTON !== 'number' || amountTON <= 0) {
    return res.status(400).json({ error: 'wallet and amountTON required' });
  }

  let info = await WalletPurchase.findOne({ wallet });
  if (!info) info = new WalletPurchase({ wallet, tpc: 0, ton: 0, last: 0 });
  if (info.last && Date.now() - info.last.getTime() < PURCHASE_INTERVAL_MS) {
    return res.status(429).json({ error: 'Please wait before buying again.' });
  }

  const round = PRESALE_ROUNDS[state.currentRound - 1];
  if (!round) return res.status(400).json({ error: 'presale ended' });

  let tpc = Math.floor(amountTON / state.currentPrice);
  if (tpc <= 0) return res.status(400).json({ error: 'amount too small' });

  const remaining = round.maxTokens - state.tokensSold;
  if (tpc > remaining) {
    return res.status(400).json({ error: 'Not enough tokens left in current round' });
  }
  if (info.tpc + tpc > MAX_TPC_PER_WALLET) {
    return res.status(400).json({ error: 'You have reached the presale limit for your wallet.' });
  }
  info.tpc += tpc;
  info.ton += amountTON;
  info.last = new Date();
  state.tonRaised += amountTON;
  state.tokensSold += tpc;
  state.currentPrice = Number((state.currentPrice + PRICE_INCREASE_STEP).toFixed(9));
  if (state.tokensSold >= round.maxTokens) {
    state.currentRound += 1;
    state.tokensSold = 0;
    state.tonRaised = 0;
    const next = PRESALE_ROUNDS[state.currentRound - 1];
    state.currentPrice = next ? next.pricePerTPC : state.currentPrice;
  }
  await info.save();
  await saveState();
  res.json({ tpc, currentPrice: state.currentPrice, round: state.currentRound });
});

router.post('/claim', async (req, res) => {
  await loadState();
  const { accountId, txHash } = req.body;
  if (!accountId || !txHash) {
    return res.status(400).json({ error: 'accountId and txHash required' });
  }

  const user = await User.findOne({ accountId });
  if (!user) return res.status(404).json({ error: 'account not found' });

  const dup = await User.findOne({ 'transactions.txHash': txHash });
  if (dup) {
    const existing = dup.transactions.find((t) => t.txHash === txHash);
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
    const out = (data.out_msgs || []).find(
      (m) => normalize(m.destination?.address) === STORE_ADDRESS_NORM
    );
    const sender = normalize(data.in_msg?.source?.address || '');
    if (!out) return res.status(400).json({ error: 'destination mismatch' });
    const tonVal = Number(out.value) / 1e9;

    const round = PRESALE_ROUNDS[state.currentRound - 1];
    if (!round) return res.status(400).json({ error: 'presale ended' });

    let tpc = Math.floor(tonVal / state.currentPrice);
    if (tpc <= 0)
      return res.status(400).json({ error: 'amount too small' });

    const remaining = round.maxTokens - state.tokensSold;
    if (tpc > remaining) {
      return res
        .status(400)
        .json({ error: 'Not enough tokens left in current round' });
    }

    const wallet = sender || user.walletAddress;
    if (wallet) {
      let rec = await WalletPurchase.findOne({ wallet });
      if (!rec) rec = new WalletPurchase({ wallet, tpc: 0, ton: 0, last: 0 });
      rec.tpc += tpc;
      rec.ton += tonVal;
      rec.last = new Date();
      await rec.save();
    }

    state.tonRaised += tonVal;
    state.tokensSold += tpc;
    state.currentPrice = Number(
      (state.currentPrice + PRICE_INCREASE_STEP).toFixed(9)
    );
    if (state.tokensSold >= round.maxTokens) {
      state.currentRound += 1;
      state.tokensSold = 0;
      state.tonRaised = 0;
      const next = PRESALE_ROUNDS[state.currentRound - 1];
      state.currentPrice = next ? next.pricePerTPC : state.currentPrice;
    }
    await saveState();

    ensureTransactionArray(user);
    user.balance += tpc;
    user.transactions.push({
      amount: tpc,
      type: 'presale',
      token: 'TPC',
      status: 'delivered',
      date: new Date(),
      txHash,
    });
    await user.save();

    res.json({
      balance: user.balance,
      tpc,
      currentPrice: state.currentPrice,
      round: state.currentRound,
    });
  } catch (err) {
    console.error('Failed to verify presale claim:', err.message);
    res.status(500).json({ error: 'verification failed' });
  }
});

export default router;
