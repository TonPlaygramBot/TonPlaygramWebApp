import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import GiftDelivery from '../models/GiftDelivery.js';
import { GIFT_BY_ID } from '../../shared/giftCatalog.js';

export class GiftDeliveryError extends Error {
  constructor(message, code, status = 400, rejected = true) {
    super(message); Object.assign(this, { code, status, rejected });
  }
}
const reject = (message, code, status) => { throw new GiftDeliveryError(message, code, status); };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function replay(record, toAccount, giftId) {
  if (record.toAccount !== toAccount || record.giftId !== giftId) {
    throw new GiftDeliveryError('This request belongs to a different gift. Resume the original request.', 'REQUEST_CONFLICT', 409, false);
  }
  return record.receipt;
}

/** Atomic in-app delivery. No network calls or external minting inside a retryable transaction. */
export async function deliverGift({ fromAccount, toAccount, gift: giftId, requestId }, authorize, {
  UserModel = User, DeliveryModel = GiftDelivery,
  externalMintConfigured = Boolean(process.env.NFT_API_BASE_URL)
} = {}) {
  if (typeof fromAccount !== 'string' || typeof toAccount !== 'string' ||
      !fromAccount.trim() || !toAccount.trim() || fromAccount.length > 128 || toAccount.length > 128) {
    reject('Valid sender and recipient accounts are required.', 'INVALID_ACCOUNT');
  }
  if (typeof requestId !== 'string' || !uuid.test(requestId)) {
    reject('Update the app before sending a gift.', 'REQUEST_ID_REQUIRED', 428);
  }
  if (typeof giftId !== 'string' || !Object.hasOwn(GIFT_BY_ID, giftId)) reject('Invalid gift.', 'INVALID_GIFT');
  const gift = GIFT_BY_ID[giftId];
  const key = `${fromAccount}:${requestId.toLowerCase()}`;
  const session = await UserModel.db.startSession();
  const date = new Date(), giftEntryId = randomUUID();
  let receipt;
  try {
    await session.withTransaction(async () => {
      const sender = await UserModel.findOne({ accountId: fromAccount }).session(session).lean();
      if (!sender) reject('Sender account not found.', 'SENDER_NOT_FOUND', 404);
      if (!authorize(sender)) reject('Forbidden.', 'FORBIDDEN', 403);
      const previous = await DeliveryModel.findById(key).session(session).lean();
      if (previous) { receipt = replay(previous, toAccount, giftId); return; }
      const terminalRejection = async (error, code) => {
        receipt = { requestId, requestStatus: 'rejected', rejected: true, error, code };
        await DeliveryModel.create([{ _id: key, fromAccount, toAccount, giftId, requestId, receipt }], { session });
      };
      // The current mint provider has no documented idempotency/reconciliation API.
      // Do not make an irreversible external call before an atomic DB commit.
      if (externalMintConfigured) reject('Gift minting is temporarily unavailable.', 'MINT_PROVIDER_UNAVAILABLE', 503);
      const receiver = fromAccount === toAccount ? sender : await UserModel.findOne({ accountId: toAccount }).session(session).lean();
      if (!receiver) { await terminalRejection('Recipient account not found.', 'RECIPIENT_NOT_FOUND'); return; }
      if (!Number.isFinite(sender.balance) || sender.balance < gift.price) { await terminalRejection('Insufficient balance.', 'INSUFFICIENT_BALANCE'); return; }
      // Fail closed on corrupt legacy array fields rather than overwriting history.
      for (const user of [sender, receiver]) {
        if ((user.transactions != null && !Array.isArray(user.transactions)) ||
            (user.gifts != null && !Array.isArray(user.gifts))) reject('Account history requires repair.', 'ACCOUNT_HISTORY_INVALID', 409);
        if (user.transactions === null || user.gifts === null) reject('Account history requires repair.', 'ACCOUNT_HISTORY_INVALID', 409);
      }
      const transaction = {
        transactionId: requestId, amount: -gift.price, type: 'gift', token: 'TPG', status: 'delivered',
        date, toAccount, detail: giftId, category: String(gift.tier), giftId: giftEntryId
      };
      // No NFT token ID is fabricated: these are in-app collectibles, not proof of an on-chain mint.
      const entry = { _id: giftEntryId, gift: giftId, price: gift.price, tier: gift.tier,
        fromAccount, fromName: sender.nickname || sender.firstName || '', date };
      const incoming = { amount: 0, type: 'gift-receive', token: 'TPG', status: 'pending', date,
        fromAccount, fromName: entry.fromName, giftId: giftEntryId, detail: giftId, category: String(gift.tier) };
      const debit = fromAccount === toAccount
        ? { $inc: { balance: -gift.price }, $push: { transactions: { $each: [transaction, incoming] }, gifts: entry } }
        : { $inc: { balance: -gift.price }, $push: { transactions: transaction } };
      const updated = await UserModel.findOneAndUpdate({ _id: sender._id, balance: { $gte: gift.price } }, debit, { session, new: true }).lean();
      if (!updated) reject('Insufficient balance.', 'INSUFFICIENT_BALANCE');
      if (fromAccount !== toAccount) {
        const delivered = await UserModel.updateOne({ _id: receiver._id }, { $push: { transactions: incoming, gifts: entry } }, { session });
        if (delivered.matchedCount !== 1) reject('Recipient account not found.', 'RECIPIENT_NOT_FOUND', 404);
      }
      receipt = { requestId, balance: updated.balance, transaction };
      await DeliveryModel.create([{ _id: key, fromAccount, toAccount, giftId, requestId, receipt }], { session });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
    return receipt;
  } catch (error) {
    // A concurrent duplicate may win the unique _id insert. Only replay its matching receipt.
    if (error.code === 11000) {
      const record = await DeliveryModel.findById(key).lean();
      if (record) return replay(record, toAccount, giftId);
    }
    throw error;
  } finally { await session.endSession(); }
}
