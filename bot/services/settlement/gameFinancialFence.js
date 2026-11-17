/**
 * Write fences for verified dependencies inside a Mongo transaction. They do not
 * debit or credit. They force concurrent eligibility/provenance changes to
 * conflict instead of allowing snapshot-isolation write skew on read-only rows.
 */
export async function fenceVerifiedGameAccount({ users, fundingAudits, user, audit, session }) {
  const hasFence = Object.hasOwn(user, 'gameFinancialFence');
  if (hasFence && (!Number.isSafeInteger(user.gameFinancialFence) || user.gameFinancialFence < 0 || user.gameFinancialFence >= Number.MAX_SAFE_INTEGER)) throw new Error('account_fence_invalid');
  const changed = await users.updateOne({ _id: user._id, tpcAccountNumber: user.tpcAccountNumber,
    balance: user.balance, transactions: user.transactions, isBanned: { $ne: true },
    gameFinancialFence: hasFence ? user.gameFinancialFence : { $exists: false } },
  { $inc: { gameFinancialFence: 1 } }, { session });
  if (changed.modifiedCount !== 1) throw new Error('account_fence_conflict');
  const advanced = await fundingAudits.updateOne({ _id: audit._id, version: audit.version, fingerprint: audit.fingerprint, status: 'verified' }, { $inc: { version: 1 } }, { session });
  if (advanced.modifiedCount !== 1) throw new Error('audit_fence_conflict');
}
