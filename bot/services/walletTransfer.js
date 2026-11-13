import { createHash } from 'node:crypto';

export class WalletTransferError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function validateWalletTransfer({ amount, operationId, note }) {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new WalletTransferError('amount_must_be_a_positive_safe_integer');
  if (typeof operationId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(operationId))
    throw new WalletTransferError('valid_operation_id_required');
  if (note != null && (typeof note !== 'string' || note.length > 150))
    throw new WalletTransferError('note_must_be_at_most_150_characters');
}

// Injecting models keeps accounting testable without an HTTP server. Production
// MUST supply the real Mongo connection; no in-memory or standalone fallback is
// safe for multi-document value transfers.
export function createWalletTransferService({ UserModel, TransferModel, database }) {
  return async function transfer({ senderId, receiverId, amount, operationId, note = '' }) {
    validateWalletTransfer({ amount, operationId, note });
    if (!senderId || !receiverId || String(senderId) === String(receiverId))
      throw new WalletTransferError('distinct_existing_accounts_required');
    if (database.connection.readyState !== 1)
      throw new WalletTransferError('transactional_database_unavailable', 503);

    const receiptId = createHash('sha256')
      .update(JSON.stringify([String(senderId), operationId]))
      .digest('hex');
    const matchReceipt = (receipt, replayed = true) => {
      if (String(receipt.receiverId) !== String(receiverId) ||
          receipt.amount !== amount || receipt.note !== note)
        throw new WalletTransferError('operation_id_conflict', 409);
      return {
        balance: receipt.senderBalance,
        transaction: receipt.senderTransaction,
        receiverBalance: receipt.receiverBalance,
        operationId,
        replayed
      };
    };

    const session = await database.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const existing = await TransferModel.findById(receiptId).session(session);
        if (existing) {
          result = matchReceipt(existing);
          return;
        }
        const sender = await UserModel.findOne({ _id: senderId, isBanned: { $ne: true } }).session(session);
        const receiver = await UserModel.findOne({ _id: receiverId, isBanned: { $ne: true } }).session(session);
        if (!sender || !receiver) throw new WalletTransferError('account_unavailable', 403);
        if (!Number.isFinite(sender.balance) || sender.balance < amount)
          throw new WalletTransferError('insufficient_balance');
        if (!Number.isFinite(receiver.balance) || receiver.balance < 0 ||
            receiver.balance + amount > Number.MAX_SAFE_INTEGER)
          throw new WalletTransferError('recipient_balance_unavailable', 409);

        const date = new Date();
        const senderTransaction = {
          transactionId: `wallet:${receiptId}:send`,
          amount: -amount, type: 'send', token: 'TPG', status: 'delivered', date,
          toAccount: String(receiver.accountId),
          toName: receiver.nickname || receiver.firstName || '',
          ...(note ? { detail: note } : {})
        };
        const receiverTransaction = {
          transactionId: `wallet:${receiptId}:receive`,
          amount, type: 'receive', token: 'TPG', status: 'delivered', date,
          fromAccount: String(sender.accountId),
          fromName: sender.nickname || sender.firstName || '',
          ...(note ? { detail: note } : {})
        };
        const debited = await UserModel.updateOne(
          { _id: senderId, isBanned: { $ne: true }, balance: { $gte: amount } },
          { $inc: { balance: -amount }, $push: { transactions: senderTransaction } },
          { session }
        );
        if (debited.modifiedCount !== 1) throw new WalletTransferError('insufficient_balance');
        const credited = await UserModel.updateOne(
          { _id: receiverId, isBanned: { $ne: true }, balance: { $lte: Number.MAX_SAFE_INTEGER - amount } },
          { $inc: { balance: amount }, $push: { transactions: receiverTransaction } },
          { session }
        );
        if (credited.modifiedCount !== 1) throw new WalletTransferError('recipient_balance_unavailable', 409);
        const receipt = {
          _id: receiptId, operationId, senderId, receiverId, amount, note,
          senderBalance: sender.balance - amount,
          receiverBalance: receiver.balance + amount,
          senderTransaction,
          createdAt: date
        };
        await TransferModel.create([receipt], { session });
        result = matchReceipt(receipt, false);
      }, {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      });
      return result;
    } catch (err) {
      // Concurrent requests can race on the receipt's unique _id. Only return
      // success after reading the receipt that actually committed.
      if (err.code === 11000) {
        const committed = await TransferModel.findById(receiptId);
        if (committed) return matchReceipt(committed);
      }
      if (err instanceof WalletTransferError) throw err;
      // A failed transaction must never fall back to separate debit/credit saves.
      throw new WalletTransferError('transfer_unavailable_retry_same_operation', 503);
    } finally {
      await session.endSession();
    }
  };
}
