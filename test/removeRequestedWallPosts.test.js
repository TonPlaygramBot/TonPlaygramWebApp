import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import {
  removeRequestedWallPosts,
  requestedWallPosts
} from '../bot/migrations/removeRequestedWallPosts.js';

const record = (target) => ({
  _id: target.id,
  author: 'Anëtar i komunitetit',
  source: 'community',
  text: target.text,
  createdAt: new Date(target.createdAt),
  attachment: {
    name: target.name,
    size: target.size,
    url: `/api/flamingo-wall/files/${target.storedName}`
  }
});
function matches(item, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return expected.some((part) => matches(item, part));
    const value = key
      .split('.')
      .reduce((object, field) => object?.[field], item);
    if (expected instanceof Date)
      return new Date(value).getTime() === expected.getTime();
    if (expected?.$in)
      return expected.$in.some(
        (entry) =>
          (entry == null && value == null) || String(entry) === String(value)
      );
    if (expected?.$ne) return String(value) !== String(expected.$ne);
    if (expected?.$regex) return new RegExp(expected.$regex).test(value || '');
    return value === expected;
  });
}
describe('requested wall post removal', () => {
  let directory, documents, files, posts, db, removeDatabaseFile;
  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'wall-removal-'));
    documents = requestedWallPosts.map(record);
    documents.push({
      ...record(requestedWallPosts[0]),
      _id: 'another-post',
      attachment: undefined
    });
    files = requestedWallPosts.map((target, index) => ({
      _id: `file-${index}`,
      filename: target.storedName
    }));
    posts = {
      findById: (id) => ({
        lean: async () => documents.find((post) => post._id === id)
      }),
      findOne: (query) => ({
        lean: async () => documents.find((post) => matches(post, query))
      }),
      deleteOne: jest.fn(async (query) => {
        const index = documents.findIndex((post) => matches(post, query));
        if (index === -1) return { deletedCount: 0 };
        documents.splice(index, 1);
        return { deletedCount: 1 };
      })
    };
    db = {
      collection: () => ({
        find: (query) => ({
          toArray: async () => files.filter((file) => matches(file, query))
        })
      })
    };
    removeDatabaseFile = jest.fn(async (id) => {
      files = files.filter((file) => file._id !== id);
    });
    await Promise.all(
      requestedWallPosts.map((target) =>
        writeFile(path.join(directory, target.storedName), 'original')
      )
    );
  });
  afterEach(() => rm(directory, { recursive: true, force: true }));
  const cleanup = (options = {}) =>
    removeRequestedWallPosts({
      posts,
      db,
      directories: [directory],
      removeDatabaseFile,
      ...options
    });

  test('dry run inspects both targets without deleting posts or media', async () => {
    expect((await cleanup()).targets.map((target) => target.id)).toEqual(
      requestedWallPosts.map((target) => target.id)
    );
    expect(posts.deleteOne).not.toHaveBeenCalled();
    expect(removeDatabaseFile).not.toHaveBeenCalled();
    await expect(
      readFile(path.join(directory, requestedWallPosts[0].storedName), 'utf8')
    ).resolves.toBe('original');
  });
  test('deletes only the two reviewed posts and their exact media, then safely reruns', async () => {
    expect(await cleanup({ apply: true })).toMatchObject({
      deletedPosts: 2,
      deletedDiskFiles: 2,
      deletedDatabaseFiles: 2,
      recoveredDiskBytes: 16
    });
    expect(documents.map((post) => post._id)).toEqual(['another-post']);
    expect(await cleanup({ apply: true })).toMatchObject({
      deletedPosts: 0,
      deletedDiskFiles: 0,
      deletedDatabaseFiles: 0
    });
  });
  test('stops before any mutation when either reviewed post has changed', async () => {
    documents[1].author = 'A different author';
    await expect(cleanup({ apply: true })).rejects.toThrow(
      'changed since review'
    );
    expect(posts.deleteOne).not.toHaveBeenCalled();
    expect(removeDatabaseFile).not.toHaveBeenCalled();
  });
  test('retains media reused by a post outside the requested deletion', async () => {
    documents[2].attachment = {
      ...documents[0].attachment,
      url: '/api/flamingo-wall/files/a-legacy-alias.mp4'
    };
    expect(await cleanup({ apply: true })).toMatchObject({
      deletedPosts: 2,
      deletedDiskFiles: 1,
      deletedDatabaseFiles: 1
    });
    expect(documents.map((post) => post._id)).toEqual(['another-post']);
    await expect(
      readFile(path.join(directory, requestedWallPosts[0].storedName), 'utf8')
    ).resolves.toBe('original');
  });
  test('rejects an edit that races the inspection using the guarded deletion query', async () => {
    posts.deleteOne.mockImplementationOnce(async () => ({ deletedCount: 0 }));
    await expect(cleanup({ apply: true })).rejects.toThrow(
      'changed during deletion'
    );
    expect(removeDatabaseFile).not.toHaveBeenCalled();
  });
});
