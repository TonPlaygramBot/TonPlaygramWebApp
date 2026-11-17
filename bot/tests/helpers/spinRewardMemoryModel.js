import { isDeepStrictEqual } from 'node:util';
// Test-only Mongo operator model. These tests supplement, not replace, Mongo integration.
const copy = (value) => structuredClone(value);
const get = (value, path) => path.split('.').reduce((v, key) => Array.isArray(v) ? v.map((entry) => entry?.[key]) : v?.[key], value);
function set(doc, path, value) {
  const parts = path.split('.'); const key = parts.pop();
  const parent = parts.reduce((v, part) => (v[part] ??= {}), doc); parent[key] = value;
}
function match(doc, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((item) => match(doc, item));
    const value = get(doc, key);
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      return Object.entries(expected).every(([op, x]) => {
        if (op === '$eq') return isDeepStrictEqual(value, x);
        if (op === '$gte') return value !== undefined && value >= x;
        if (op === '$ne') return Array.isArray(value) ? !value.includes(x) : value !== x;
        if (op === '$exists') return (value !== undefined) === x;
        if (op === '$lte') return value !== undefined && value <= x;
        if (op === '$type') return x === 'array' ? Array.isArray(value) : typeof value === x;
        throw new Error(`Unsupported test operator: ${op}`);
      });
    }
    return value === expected;
  });
}
export function makeMemoryModel() {
  const docs = new Map(); let sequence = 0;
  const query = (getValue) => ({ lean: async () => copy(getValue()) });
  const update = (filter, operation) => {
    const doc = [...docs.values()].find((value) => match(value, filter)); if (!doc) return null;
    for (const [path, value] of Object.entries(operation.$set || {})) set(doc, path, copy(value));
    for (const [path, value] of Object.entries(operation.$inc || {})) set(doc, path, (get(doc, path) || 0) + value);
    for (const [path, value] of Object.entries(operation.$push || {})) { const list = get(doc, path) || []; list.push(copy(value)); set(doc, path, list); }
    return doc;
  };
  const model = {
    create: async (fields) => { const doc = { _id: String(++sequence), balance: 0, transactions: [], ...copy(fields) }; docs.set(doc._id, doc); return copy(doc); },
    deleteMany: async () => docs.clear(),
    findOne: (filter) => query(() => [...docs.values()].find((doc) => match(doc, filter)) || null),
    findById: async (id) => copy(docs.get(id)),
    findOneAndUpdate: (filter, operation) => query(() => update(filter, operation)),
    updateOne: async (filter, operation) => copy(update(filter, operation)),
    collection: { findOneAndUpdate: async (filter, operation) => copy(update(filter, operation)), updateOne: async (filter, operation) => copy(update(filter, operation)), findOne: async (filter) => copy([...docs.values()].find((doc) => match(doc, filter))) }
  };
  return model;
}
