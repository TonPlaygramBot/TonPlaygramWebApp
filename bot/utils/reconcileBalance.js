import User from '../models/User.js';
import { resolveAccountBalance } from './userUtils.js';

// Preserve legacy upward reconciliation only while BOTH wallet inputs match.
// Use raw collection reads/writes: Mongoose hydration/casting adds transaction
// defaults that may not exist in legacy ledgers and would invalidate equality.
export async function reconcileBalanceSnapshot(user, Model = User) {
  if (!user) return null;
  const collection = Model.collection;
  const snapshot = await collection.findOne({ _id: user._id });
  if (!snapshot) return null;
  const present = (raw) => raw ? Model.hydrate(raw) : null;
  const balance = resolveAccountBalance({ ...snapshot });
  if (snapshot.balance === balance) return present(snapshot);
  const equal = (value) => value === undefined ? { $exists: false } : { $eq: value };
  const updated = await collection.findOneAndUpdate(
    { _id: snapshot._id, balance: equal(snapshot.balance), transactions: equal(snapshot.transactions) },
    { $set: { balance } },
    { returnDocument: 'after', includeResultMetadata: false }
  );
  // Do not retry repair after a race, normalize the ledger, or upsert a user
  // deleted concurrently. All other profile fields come from current state.
  return present(updated || await collection.findOne({ _id: snapshot._id }));
}
