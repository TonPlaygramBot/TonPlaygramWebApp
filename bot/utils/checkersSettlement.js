// Pure settlement plan; the server performs the database writes. Each account's
// credit and receipt share an atomic update, so retries cannot credit it twice.
export function buildCheckersSettlement({ tableId, winnerId, loserId, draw = false, playerIds = [], stake, token = 'TPG', reason, now = new Date() }) {
  const amount = Number(stake);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const ids = draw ? playerIds : [winnerId, loserId];
  if (ids.some((id) => id == null || String(id).trim() === '')) throw new Error('missing_players');
  const accounts = ids.map(String);
  if (accounts.length !== 2 || new Set(accounts).size !== 2) throw new Error('missing_players');
  const idempotencyKey = `${tableId}:1`;
  const operations = accounts.map((accountId, index) => {
    const payout = draw ? amount : index === 0 ? amount * 2 : 0;
    const transactionId = `checkers:${idempotencyKey}:${accountId}`;
    return { updateOne: {
      filter: { accountId, isBanned: { $ne: true }, 'transactions.transactionId': { $ne: transactionId } },
      update: {
        ...(payout ? { $inc: { balance: payout } } : {}),
        $push: { transactions: {
          transactionId, amount: payout,
          type: draw ? 'stake_refund' : index === 0 ? 'game_win' : 'game_loss',
          token, game: 'checkersbattle', players: 2,
          detail: `checkers:${tableId}:${reason}`, date: now
        } }
      }
    } };
  });
  return { idempotencyKey, operations, accounts, draw, payoutAmount: draw ? 0 : amount * 2, refundAmount: draw ? amount : 0 };
}
