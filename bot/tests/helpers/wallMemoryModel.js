import { mock } from 'node:test';
import sift from 'sift';
export function memoryModel(Model) {
  const rows = [];
  const matches = (query) => (sift.default ? sift.default(query) : sift(query));
  const clone = (value) => (value == null ? value : structuredClone(value));
  const sorted = (rows, sort = {}) =>
    [...rows].sort((a, b) => {
      for (const [field, direction] of Object.entries(sort)) {
        const result = a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0;
        if (result) return result * direction;
      }
      return 0;
    });
  const query = (read) => {
    let sort, selected;
    const value = () => {
      const result = clone(read(sort));
      if (
        Model.modelName === 'WallPushKey' &&
        selected !== '+privateKey' &&
        result
      )
        delete result.privateKey;
      return result;
    };
    const cursor = {
      select: (field) => {
        selected = field;
        return cursor;
      },
      sort: (order) => {
        sort = order;
        return cursor;
      },
      lean: async () => value(),
      then: (resolve, reject) => Promise.resolve(value()).then(resolve, reject)
    };
    return cursor;
  };
  const update = (row, changes) => {
    Object.assign(row, clone(changes.$set || {}));
    for (const [field, amount] of Object.entries(changes.$inc || {}))
      row[field] = (row[field] || 0) + amount;
  };
  const create = async (content) => {
    const document = new Model(content);
    await document.validate();
    const row = document.toObject();
    // ObjectIds are compared as ordered strings by this repository double.
    if (typeof row._id !== 'string') row._id = String(row._id);
    rows.push(row);
    return clone(row);
  };
  mock.method(Model, 'create', create);
  mock.method(Model, 'findById', (id) =>
    query(() => rows.find((row) => String(row._id) === String(id)) || null)
  );
  mock.method(Model, 'find', (criteria) =>
    query((order) => sorted(rows.filter(matches(criteria)), order))
  );
  mock.method(Model, 'findOne', (criteria) =>
    query((order) => sorted(rows.filter(matches(criteria)), order)[0] || null)
  );
  mock.method(Model, 'exists', async (criteria) =>
    rows.some(matches(criteria))
  );
  mock.method(Model, 'deleteOne', async (criteria) => {
    const index = rows.findIndex(matches(criteria));
    if (index >= 0) rows.splice(index, 1);
  });
  mock.method(
    Model,
    'countDocuments',
    async (criteria) => rows.filter(matches(criteria)).length
  );
  mock.method(Model, 'updateMany', async (criteria, changes) =>
    rows.filter(matches(criteria)).forEach((row) => update(row, changes))
  );
  mock.method(Model, 'updateOne', async (criteria, changes, options = {}) => {
    let row = rows.find(matches(criteria));
    if (!row && options.upsert) {
      await create({ ...criteria, ...changes.$setOnInsert, ...changes.$set });
      return;
    }
    if (row) update(row, changes);
  });
  mock.method(Model, 'findOneAndUpdate', (criteria, changes, options = {}) =>
    query(() => {
      let row = sorted(rows.filter(matches(criteria)), options.sort)[0];
      if (!row && options.upsert) {
        row = { ...criteria, ...clone(changes.$setOnInsert) };
        rows.push(row);
      }
      if (row) update(row, changes);
      return row || null;
    })
  );
}
