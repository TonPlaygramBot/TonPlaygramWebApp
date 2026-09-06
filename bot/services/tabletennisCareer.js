import { randomUUID } from 'node:crypto';
import TableTennisCareer from '../models/TableTennisCareer.js';
import { shouldUseMemoryUserStore } from '../utils/memoryUserStore.js';
import {
  freshCareer,
  careerResult,
  normalizeCareer
} from '../../shared/tabletennis/career.js';
const memory = new Map();
export async function updateTableTennisCareer(accountId, action, body = {}) {
  const inMemory = shouldUseMemoryUserStore();
  if (inMemory && !memory.has(accountId))
    memory.set(accountId, { accountId, career: freshCareer(), revision: 0 });
  if (!inMemory)
    await TableTennisCareer.updateOne(
      { accountId },
      { $setOnInsert: { career: freshCareer(), revision: 0 } },
      { upsert: true }
    );
  for (let attempt = 0; attempt < 4; attempt++) {
    const p = inMemory
      ? structuredClone(memory.get(accountId))
      : await TableTennisCareer.findOne({ accountId }).lean();
    const c = normalizeCareer(p.career);
    if (action === 'get') return c;
    const changes = {};
    let result;
    if (action === 'start') {
      if (c.completed) throw Error('career_complete');
      changes.active = randomUUID();
      result = { id: changes.active, career: c };
    } else if (action === 'finish') {
      if (body.id && body.id === p.lastMatch) return c;
      if (!body.id || body.id !== p.active) throw Error('match_not_active');
      if (typeof body.won !== 'boolean' || !Number.isFinite(body.rally))
        throw Error('invalid_result');
      changes.career = careerResult(
        c,
        body.won,
        Math.max(0, Math.min(1000, Math.floor(body.rally)))
      );
      changes.active = null;
      changes.lastMatch = body.id;
      result = changes.career;
    } else if (action === 'upgrade') {
      const stat = body.stat;
      if (
        !Number.isInteger(stat) ||
        stat < 0 ||
        stat > 2 ||
        c.credits < 2 ||
        c.upgrades[stat] >= 3
      )
        throw Error('training_unavailable');
      c.credits -= 2;
      c.upgrades[stat]++;
      changes.career = c;
      result = c;
    } else throw Error('invalid_career_action');
    if (inMemory) {
      memory.set(accountId, { ...p, ...changes, revision: p.revision + 1 });
      return result;
    }
    const updated = await TableTennisCareer.updateOne(
      { accountId, revision: p.revision },
      { $set: changes, $inc: { revision: 1 } }
    );
    if (updated.modifiedCount) return result;
  }
  throw Error('save_changed_retry');
}
