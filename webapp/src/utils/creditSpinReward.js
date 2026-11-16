import { addTransaction, getWalletBalance, updateBalance } from './api.js';

let pendingCredit = Promise.resolve();

export function creditSpinReward(telegramId, amount, type) {
  // Both Earn wheels write an absolute balance through the same wallet API.
  // Serialize them so one win cannot overwrite the other on this page.
  const credit = pendingCredit.then(async () => {
    const wallet = await getWalletBalance(telegramId);
    if (!Number.isFinite(wallet.balance)) throw new Error('Could not read the reward balance');

    const updated = await updateBalance(telegramId, wallet.balance + amount);
    if (updated.error) throw new Error(updated.error);

    const transaction = await addTransaction(telegramId, amount, type);
    if (transaction.error) throw new Error(transaction.error);
  });
  pendingCredit = credit.catch(() => {});
  return credit;
}
