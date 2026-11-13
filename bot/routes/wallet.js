import { Router } from 'express';
import { withProxy } from '../utils/proxyAgent.js';

import User from '../models/User.js';
import WalletTransfer from '../models/WalletTransfer.js';
import { createWalletTransferService, validateWalletTransfer, WalletTransferError } from '../services/walletTransfer.js';

import Message from '../models/Message.js';

import {
  ensureTransactionArray
} from '../utils/userUtils.js';

import authenticate from '../middleware/auth.js';
import { blockExternalValueInMobileStore } from '../config/mobileStorePolicy.js';


// Track USDT using the official jetton master address on TON
const USDT_JETTON_HEX =
  '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe';

const router = Router();
const transferWallet = createWalletTransferService({
  UserModel: User,
  TransferModel: WalletTransfer,
  database: User.base
});

function canAccessUser(req, user) {
  if (!user) return false;
  if (req.auth?.apiToken) return true;
  if (user.telegramId && req.auth?.telegramId && user.telegramId === req.auth.telegramId) return true;
  if (user.googleId && req.auth?.googleId && user.googleId === req.auth.googleId) return true;
  if (user.accountId && req.auth?.accountId && user.accountId === req.auth.accountId) return true;
  return false;
}

async function getAuthenticatedUser(req) {
  if (req.auth?.accountId) {
    return User.findOne({ accountId: req.auth.accountId });
  }
  if (req.auth?.telegramId) {
    return User.findOne({ telegramId: req.auth.telegramId });
  }
  if (req.auth?.googleId) {
    return User.findOne({ googleId: req.auth.googleId });
  }
  return null;
}

router.post('/balance', authenticate, async (req, res) => {

  const { telegramId, accountId } = req.body;

  let user;
  if (accountId) {
    user = await User.findOne({ accountId });
    if (user && !canAccessUser(req, user)) {
      return res.status(403).json({ error: 'forbidden' });
    }
  } else if (telegramId) {
    user = await User.findOne({ telegramId });
    if (user && !canAccessUser(req, user)) {
      return res.status(403).json({ error: 'forbidden' });
    }
  } else {
    user = await getAuthenticatedUser(req);
  }

  if (!user) {
    if (req.auth?.telegramId) {
      user = await User.findOneAndUpdate(
        { telegramId: req.auth.telegramId },
        { $setOnInsert: { referralCode: String(req.auth.telegramId) } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else if (req.auth?.googleId) {
      user = await User.findOneAndUpdate(
        { googleId: req.auth.googleId },
        { $setOnInsert: { referralCode: String(req.auth.googleId) } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  if (!user) {
    return res.status(400).json({ error: 'accountId or telegramId required' });
  }

  // Balance reads must never recreate spent funds from a legacy/incomplete ledger.
  const balance = Number.isFinite(user.balance) ? user.balance : 0;

  res.json({ balance });

});

// Do not solicit deposits while their settlement path is unavailable.
router.get('/deposit-address', blockExternalValueInMobileStore, (_req, res) => {
  return res.status(403).json({ error: 'verified_deposit_settlement_required' });
});

// Fetch TON balance from the blockchain using a public API

import TonWeb from 'tonweb';

function toFriendlyAddress(addr) {
  try {
    const a = new TonWeb.utils.Address(addr);
    // return standard base64 (not URL-safe) user-friendly address
    return a.toString(true, false, false);
  } catch {
    return null;
  }
}

router.post('/ton-balance', async (req, res) => {

  const { address } = req.body;

  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }

  const raw = toFriendlyAddress(address);
  if (!raw) {
    return res.status(400).json({ error: 'invalid address' });
  }

  try {

    const resp = await fetch(
      `https://toncenter.com/api/v2/getAddressBalance?address=${encodeURIComponent(raw)}`,
      withProxy()
    );

    const data = await resp.json();

    if (!data.ok) {

      return res.status(400).json({ error: data.error || 'failed to fetch' });

    }

    const balance = Number(data.result) / 1e9; // nanotons -> TON

    res.json({ balance });

  } catch (err) {

    console.error('Error fetching TON balance:', err);

    res.status(500).json({ error: 'Failed to fetch TON balance' });

  }

});

router.post('/usdt-balance', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }
  const raw = toFriendlyAddress(address);
  if (!raw) {
    return res.status(400).json({ error: 'invalid address' });
  }
  try {
    const resp = await fetch(
      `https://tonapi.io/v2/accounts/${encodeURIComponent(raw)}/jettons`,
      withProxy()
    );
    const data = await resp.json();
    const jetton = (data.balances || []).find(
      (j) =>
        j.jetton?.address === USDT_JETTON_HEX ||
        j.jetton?.symbol === 'USDT' ||
        j.jetton?.symbol === 'jUSDT'
    );
    let balance = 0;
    if (jetton) {
      const decimals = jetton.jetton?.decimals || 0;
      balance = Number(jetton.balance) / 10 ** decimals;
    }
    res.json({ balance });
  } catch (err) {
    console.error('Error fetching USDT balance:', err);
    res.status(500).json({ error: 'Failed to fetch USDT balance' });
  }
});

// Transfer only to existing accounts. The service commits both balances, both
// history entries and the idempotency receipt in a single MongoDB transaction.
export async function sendWalletTransfer(req, res) {
  const { fromId, toId, fromAccountId, toAccountId, amount, note } = req.body;
  const operationId = req.get('Idempotency-Key') || req.body.operationId;
  const accountFilter = (accountId, telegramId) => {
    if (accountId !== undefined) {
      if (typeof accountId !== 'string' || !accountId || accountId.length > 128)
        throw new WalletTransferError('invalid_account_id');
      return { accountId };
    }
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0)
      throw new WalletTransferError('valid_account_or_telegram_id_required');
    return { telegramId };
  };

  try {
    validateWalletTransfer({ amount, operationId, note });
    const sender = await User.findOne(accountFilter(fromAccountId, fromId));
    if (!sender || !canAccessUser(req, sender))
      return res.status(403).json({ error: 'forbidden' });
    const receiver = await User.findOne(accountFilter(toAccountId, toId));
    if (!receiver) return res.status(404).json({ error: 'recipient_not_found' });

    const result = await transferWallet({
      senderId: sender._id, receiverId: receiver._id,
      amount, operationId, note: note || ''
    });

    // Notifications are best effort and only run after a successful new commit.
    // A notification failure must never undo or repeat a money transfer.
    if (!result.replayed && receiver.telegramId) {
      const senderName = sender.nickname || sender.firstName || String(sender.accountId);
      const detailText = `You received ${amount} TPG from ${senderName}. ` +
        `New balance: ${result.receiverBalance} TPG.` + (note ? ` Note: ${note}` : '');
      try {
        const [{ default: bot }, { sendTransferNotification }] = await Promise.all([
          import('../bot.js'), import('../utils/notifications.js')
        ]);
        await sendTransferNotification(bot, receiver.telegramId, sender.telegramId, amount, note);
        await Message.create({ from: 0, to: Number(receiver.telegramId), text: detailText });
      } catch (err) {
        console.error('Failed to notify wallet transfer:', err.message);
      }
    }
    return res.json({
      balance: result.balance, transaction: result.transaction,
      operationId: result.operationId, replayed: result.replayed
    });
  } catch (err) {
    const status = err instanceof WalletTransferError ? err.status : 503;
    const error = err instanceof WalletTransferError ? err.code : 'transfer_unavailable_retry_same_operation';
    if (status >= 500) console.error('Wallet transfer unavailable:', err.message);
    return res.status(status).json({ error });
  }
}
router.post('/send', authenticate, sendWalletTransfer);

// Client supplied amounts are not proof of a payment. Re-enable credit only via
// a verified, replay-protected settlement service after its independent audit.
router.post('/deposit', authenticate, blockExternalValueInMobileStore, (_req, res) => {
  return res.status(403).json({ error: 'verified_deposit_settlement_required' });
});

// Submission to TON is not final settlement. Both aliases fail closed until a
// durable withdrawal reservation and chain-confirmation reconciler are in place;
// WITHDRAW_ENABLED alone intentionally cannot bypass this launch restriction.
for (const path of ['/withdraw', '/claim-external']) {
  router.post(path, authenticate, blockExternalValueInMobileStore, (_req, res) => {
    return res.status(403).json({ error: 'withdrawals_unavailable_pending_verified_settlement' });
  });
}

// ✅ Authenticated transaction history

router.post('/transactions', authenticate, async (req, res) => {

  const { telegramId, accountId } = req.body;

  if (!telegramId && !accountId) {

    return res.status(400).json({ error: 'telegramId or accountId required' });

  }

  let user;
  if (accountId) {
    user = await User.findOne({ accountId });
    if (!user) {
      return res.status(404).json({ error: 'account not found' });
    }
    if (!canAccessUser(req, user)) {
      return res.status(403).json({ error: 'forbidden' });
    }
  } else {
    user = await User.findOne({ telegramId });
    if (user && !canAccessUser(req, user)) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }

  if (user) {
    // Ensure the transactions property is always an array
    ensureTransactionArray(user);

    // Persist fixes for legacy string data
    if (user.isModified('transactions')) {
      try {
        await user.save();
      } catch (err) {
        console.error(
          'Failed to save user after ensuring transaction array:',
          err.message
        );
      }
    }
  }

  res.json({ transactions: user ? user.transactions : [] });

});


// Monetary history is not a user-resettable preference. Controlled maintenance
// must use the administrative reconciliation scripts with a retained audit trail.
router.post('/reset', authenticate, (_req, res) => {
  return res.status(403).json({ error: 'wallet_reset_disabled' });
});

export default router;
