import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import {
  MAX_TPC_PER_WALLET,
  PURCHASE_INTERVAL_MS,
  INITIAL_PRICE,
  PRICE_INCREASE_STEP,
  PRESALE_ROUNDS,
} from '../config.js';

const router = Router();
const dataDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../data');
const purchasesPath = path.join(dataDir, 'walletPurchases.json');
const statePath = path.join(dataDir, 'presaleState.json');

function readJson(file, def) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return def;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let walletPurchases = readJson(purchasesPath, {});
let state = readJson(statePath, {
  currentRound: 1,
  tokensSold: 0,
  currentPrice: INITIAL_PRICE,
});

router.get('/status', (_req, res) => {
  const round = PRESALE_ROUNDS[state.currentRound - 1] || {};
  const remaining = round.maxTokens ? round.maxTokens - state.tokensSold : 0;
  res.json({
    currentPrice: state.currentPrice,
    currentRound: state.currentRound,
    remainingTokens: remaining,
    maxPerWallet: MAX_TPC_PER_WALLET,
  });
});

router.post('/', (req, res) => {
  const { wallet, amountTON } = req.body;
  if (!wallet || typeof amountTON !== 'number' || amountTON <= 0) {
    return res.status(400).json({ error: 'wallet and amountTON required' });
  }
  const info = walletPurchases[wallet] || { tpc: 0, last: 0 };
  if (Date.now() - info.last < PURCHASE_INTERVAL_MS) {
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
  info.last = Date.now();
  walletPurchases[wallet] = info;
  state.tokensSold += tpc;
  state.currentPrice = Number((state.currentPrice + PRICE_INCREASE_STEP).toFixed(9));
  if (state.tokensSold >= round.maxTokens) {
    state.currentRound += 1;
    state.tokensSold = 0;
    const next = PRESALE_ROUNDS[state.currentRound - 1];
    state.currentPrice = next ? next.pricePerTPC : state.currentPrice;
  }
  writeJson(purchasesPath, walletPurchases);
  writeJson(statePath, state);
  res.json({ tpc, currentPrice: state.currentPrice, round: state.currentRound });
});

export default router;
