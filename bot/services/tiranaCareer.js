import TiranaCareer from '../models/TiranaCareer.js';
import { shouldUseMemoryUserStore } from '../utils/memoryUserStore.js';
import {
  freshCareer,
  awardCareer
} from '../../webapp/src/games/tiranastreets/shared/engine.mjs';

const memory = new Map();
export function createTiranaCareerStore({
  Model = TiranaCareer,
  inMemory = shouldUseMemoryUserStore
} = {}) {
  async function read(accountId) {
    if (inMemory()) {
      if (!memory.has(accountId))
        memory.set(accountId, { career: freshCareer(), revision: 0 });
      return structuredClone(memory.get(accountId));
    }
    await Model.updateOne(
      { accountId },
      { $setOnInsert: { career: freshCareer(), revision: 0 } },
      { upsert: true }
    );
    return Model.findOne({ accountId }).lean();
  }
  return {
    async load(accountId) {
      return (await read(accountId)).career;
    },
    async complete(accountId, state, playerId) {
      // Only the authoritative simulation reaches this function. No client score endpoint.
      for (let attempt = 0; attempt < 5; attempt++) {
        const row = await read(accountId),
          career = awardCareer(row.career, state, playerId);
        if (JSON.stringify(career) === JSON.stringify(row.career))
          return career;
        if (inMemory()) {
          memory.set(accountId, { career, revision: row.revision + 1 });
          return career;
        }
        const updated = await Model.updateOne(
          { accountId, revision: row.revision },
          { $set: { career }, $inc: { revision: 1 } }
        );
        if (updated.modifiedCount) return career;
      }
      throw Error('Career save is pending. Keep the results screen open.');
    }
  };
}
