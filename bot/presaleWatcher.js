import TonWeb from 'tonweb';
import PresaleState from './models/PresaleState.js';
import User from './models/User.js';
import WalletPurchase from './models/WalletPurchase.js';
import {
  MAX_TPC_PER_WALLET,
  INITIAL_PRICE,
  PRICE_INCREASE_STEP,
  PRESALE_ROUNDS,
} from './config.js';
import { ensureTransactionArray } from './utils/userUtils.js';

const STORE_ADDRESS = process.env.STORE_DEPOSIT_ADDRESS ||
  'UQAPwsGyKzA4MuBnCflTVwEcTLcGS9yV6okJWQGzO5VxVYD1';

function normalize(addr) {
  try {
    return new TonWeb.utils.Address(addr).toString(true, false, false);
  } catch {
    return null;
  }
}

const STATE_ID = 'singleton';
let state = null;
async function loadState() {
  if (!state) {
    state = await PresaleState.findById(STATE_ID);
    if (!state) {
      const legacy = await PresaleState.findOne();
      if (legacy) {
        state = legacy;
      } else {
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
  }
  return state;
}

async function saveState() {
  if (state) await state.save();
}

let lastTime = 0;

async function processTransactions() {
  try {
    const resp = await fetch(
      `https://tonapi.io/v2/blockchain/accounts/${STORE_ADDRESS}/transactions?limit=50`
    );
    if (!resp.ok) return;
    const data = await resp.json();
    const txs = (data.transactions || []).sort((a, b) => a.utime - b.utime);
    for (const tx of txs) {
      if (!tx.in_msg || !tx.in_msg.source?.address) continue;
      if (tx.utime <= lastTime) continue;
      const txHash = tx.hash;
      const dup = await User.findOne({ 'transactions.txHash': txHash });
      if (dup) {
        lastTime = Math.max(lastTime, tx.utime);
        continue;
      }
      const sender = normalize(tx.in_msg.source.address);
      if (!sender) {
        lastTime = Math.max(lastTime, tx.utime);
        continue;
      }
      const user = await User.findOne({ walletAddress: sender });
      if (!user) {
        lastTime = Math.max(lastTime, tx.utime);
        continue;
      }
      const tonVal = Number(tx.in_msg.value) / 1e9;
      const st = await loadState();
      const round = PRESALE_ROUNDS[st.currentRound - 1];
      if (!round) continue;
      let tpc = Math.floor(tonVal / st.currentPrice);
      if (tpc <= 0) {
        lastTime = Math.max(lastTime, tx.utime);
        continue;
      }
      const remaining = round.maxTokens - st.tokensSold;
      if (tpc > remaining) tpc = remaining;
      let rec = await WalletPurchase.findOne({ wallet: sender });
      if (!rec) rec = new WalletPurchase({ wallet: sender, tpc: 0, ton: 0, last: 0 });
      if (rec.tpc + tpc > MAX_TPC_PER_WALLET) {
        tpc = MAX_TPC_PER_WALLET - rec.tpc;
        if (tpc <= 0) {
          lastTime = Math.max(lastTime, tx.utime);
          continue;
        }
      }
      rec.tpc += tpc;
      rec.ton += tonVal;
      rec.last = new Date(tx.utime * 1000);
      await rec.save();

      st.tonRaised += tonVal;
      st.tokensSold += tpc;
      st.currentPrice = Number((st.currentPrice + PRICE_INCREASE_STEP).toFixed(9));
      if (st.tokensSold >= round.maxTokens) {
        st.currentRound += 1;
        st.tokensSold = 0;
        st.tonRaised = 0;
        const next = PRESALE_ROUNDS[st.currentRound - 1];
        st.currentPrice = next ? next.pricePerTPC : st.currentPrice;
      }
      await saveState();

      ensureTransactionArray(user);
      user.balance += tpc;
      user.transactions.push({
        amount: tpc,
        type: 'presale',
        token: 'TPC',
        status: 'delivered',
        date: new Date(tx.utime * 1000),
        txHash,
      });
      await user.save();
      lastTime = Math.max(lastTime, tx.utime);
    }
  } catch (err) {
    console.error('Presale watcher error:', err.message);
  }
}

export function startPresaleWatcher() {
  processTransactions();
  setInterval(processTransactions, 60_000);
}
