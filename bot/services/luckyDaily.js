const fail = (code, status = 409) => Object.assign(new Error(code), { code, status });

// The daily award is fixed and uses the server's UTC date. Raw collection CAS
// avoids Mongoose injecting legacy transaction defaults into equality checks.
export function createLuckyDaily({ User, clock = Date.now }) {
  return {
    async claim(userId) {
      const now = clock();
      const day = new Date(now).toISOString().slice(0, 10);
      const start = Date.parse(`${day}T00:00:00.000Z`);
      const nextClaimAt = start + 86400000;
      const transactionId = `lucky-daily:${String(userId)}:${day}`;
      for (let attempt = 0; attempt < 4; attempt++) {
        const user = await User.collection.findOne({ _id: userId, isBanned: { $ne: true } });
        if (!user) throw fail('account_not_found', 404);
        if (!Number.isFinite(user.balance) || !Array.isArray(user.transactions) || user.transactions.some(tx => !tx || typeof tx !== 'object')) throw fail('account_requires_repair');
        const response = { claimed: true, amount: 100, balance: user.balance, day, nextClaimAt };
        if (user.transactions.some(tx => tx.transactionId === transactionId)) return { ...response, alreadyClaimed: true };
        // Old clients recorded the daily award as lucky +100. Avoid paying again
        // when that evidence exists. Do not trust any localStorage claim marker.
        const legacy = user.transactions.some(tx => tx.type === 'lucky' && tx.amount === 100 &&
          new Date(tx.date).getTime() >= start && new Date(tx.date).getTime() < nextClaimAt);
        if (legacy) return { ...response, alreadyClaimed: true, legacy: true };
        const updated = await User.collection.findOneAndUpdate(
          { _id: userId, isBanned: { $ne: true }, balance: { $type: 'number', $gte: -Number.MAX_VALUE, $lte: Number.MAX_VALUE }, transactions: { $eq: user.transactions } },
          { $inc: { balance: 100 }, $push: { transactions: {
            transactionId, amount: 100, type: 'lucky_daily', token: 'TPG', status: 'delivered', date: new Date(now)
          } } },
          { returnDocument: 'after', includeResultMetadata: false }
        );
        if (updated) return { ...response, balance: updated.balance, alreadyClaimed: false };
      }
      throw fail('reward_busy_retry');
    }
  };
}
