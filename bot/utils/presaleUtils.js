import PresaleTransaction from '../models/PresaleTransaction.js';
import PresaleState from '../models/PresaleState.js';
import WalletPurchase from '../models/WalletPurchase.js';
import { MAX_TPC_PER_WALLET, PRESALE_ROUNDS } from '../config.js';
import { ensureTransactionArray } from './userUtils.js';

async function loadState() {
  const st = await PresaleState.findById('singleton');
  return st;
}

async function saveState(state) {
  if (state) await state.save();
}

export async function creditPendingPresale(user) {
  if (!user?.walletAddress) return;
  const wallet = user.walletAddress;
  const records = await PresaleTransaction.find({ wallet, processed: false });
  if (!records.length) return;

  let state = await loadState();
  for (const rec of records) {
    let tpc = rec.tpc;
    const tonVal = rec.ton;
    const round = PRESALE_ROUNDS[state.currentRound - 1];
    if (!round) continue;
    let wp = await WalletPurchase.findOne({ wallet });
    if (!wp) wp = new WalletPurchase({ wallet, tpc: 0, ton: 0, last: 0 });
    if (wp.tpc + tpc > MAX_TPC_PER_WALLET) {
      tpc = MAX_TPC_PER_WALLET - wp.tpc;
      if (tpc <= 0) {
        rec.processed = true;
        await rec.save();
        continue;
      }
      rec.tpc = tpc;
    }
    wp.tpc += tpc;
    wp.ton += tonVal;
    wp.last = rec.timestamp;
    await wp.save();

    state.tonRaised += tonVal;
    state.tokensSold += tpc;
    if (state.tokensSold >= round.maxTokens) {
      state.currentRound += 1;
      state.tokensSold = 0;
      state.tonRaised = 0;
    }
    const nextRound = PRESALE_ROUNDS[state.currentRound - 1];
    state.currentPrice = nextRound ? nextRound.pricePerTPC : state.currentPrice;
    ensureTransactionArray(user);
    user.balance += tpc;
    user.transactions.push({
      amount: tpc,
      type: 'presale',
      token: 'TPC',
      status: 'delivered',
      date: rec.timestamp,
      txHash: rec.txHash,
    });
    rec.processed = true;
    rec.accountId = user.accountId;
    await rec.save();
  }
  await saveState(state);
  await user.save();
}
