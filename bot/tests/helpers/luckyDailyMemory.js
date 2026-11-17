// Test-only raw collection model; not a substitute for real Mongo concurrency tests.
import { isDeepStrictEqual } from 'node:util';
export function luckyDailyMemory(initial) {
  let current = structuredClone(initial);
  let beforeWrite = null;
  const copy = value => structuredClone(value);
  return {
    get current() { return copy(current); },
    replace(value) { current = copy(value); },
    beforeWrite(callback) { beforeWrite = callback; },
    collection: {
      async findOne(filter) { return current && current._id === filter._id && !current.isBanned ? copy(current) : null; },
      async findOneAndUpdate(filter, update, options) {
        if (beforeWrite) { const callback = beforeWrite; beforeWrite = null; await callback(current); }
        if (!current || current._id !== filter._id || current.isBanned || !Number.isFinite(current.balance) || !isDeepStrictEqual(current.transactions, filter.transactions.$eq)) return null;
        if (options.returnDocument !== 'after' || options.includeResultMetadata !== false) throw new Error('wrong result mode');
        current.balance += update.$inc.balance;
        current.transactions.push(copy(update.$push.transactions));
        return copy(current);
      }
    }
  };
}
