import { Readable, Writable } from 'node:stream';
import mongoose from 'mongoose';
import {
  pruneFlamingoOrphanChunks,
  writeFlamingoDatabaseStream
} from '../bot/utils/flamingoStorage.js';

test('stops a failed GridFS transfer and removes its chunks before returning the original quota error', async () => {
  const failure = new Error('you are over your space quota');
  const input = Readable.from([Buffer.alloc(32), Buffer.alloc(32)]);
  const output = new Writable({
    write(_chunk, _encoding, done) {
      done(failure);
    }
  });
  const cleanup = jest.fn(async () => {
    expect(input.destroyed).toBe(true);
    expect(output.destroyed).toBe(true);
  });
  await expect(
    writeFlamingoDatabaseStream(input, output, cleanup)
  ).rejects.toBe(failure);
  expect(cleanup).toHaveBeenCalledTimes(1);
});

test('never removes a successfully completed GridFS transfer', async () => {
  const cleanup = jest.fn();
  const written = [];
  await writeFlamingoDatabaseStream(
    Readable.from(['photo']),
    new Writable({
      write(chunk, _encoding, done) {
        written.push(chunk.toString());
        done();
      }
    }),
    cleanup
  );
  expect(written.join('')).toBe('photo');
  expect(cleanup).not.toHaveBeenCalled();
});

test('orphan recovery rechecks completed files, recent chunks and post references before deletion', async () => {
  const ids = Array.from({ length: 4 }, (_, i) =>
    mongoose.Types.ObjectId.createFromTime(100 + i)
  );
  const chunks = {
    aggregate: jest.fn(() =>
      (async function* () {
        for (const id of ids) yield { _id: id, chunks: 3 };
      })()
    ),
    findOne: jest.fn(async (query) =>
      String(query.files_id) === String(ids[2]) ? { _id: 'recent chunk' } : null
    ),
    deleteMany: jest.fn(async () => ({ deletedCount: 3 }))
  };
  const files = {
    findOne: jest.fn(async (query) =>
      String(query._id) === String(ids[1]) ? { _id: ids[1] } : null
    )
  };
  const db = {
    collection: (name) => (name.endsWith('.chunks') ? chunks : files)
  };
  const isReferenced = async (id) => String(id) === String(ids[3]);
  expect(
    await pruneFlamingoOrphanChunks({ db, isReferenced, dryRun: true })
  ).toEqual({ uploads: 1, chunks: 3 });
  expect(chunks.deleteMany).not.toHaveBeenCalled();
  expect(await pruneFlamingoOrphanChunks({ db, isReferenced })).toEqual({
    uploads: 1,
    chunks: 3
  });
  expect(chunks.deleteMany).toHaveBeenCalledTimes(1);
  expect(chunks.deleteMany).toHaveBeenCalledWith({ files_id: ids[0] });
});
