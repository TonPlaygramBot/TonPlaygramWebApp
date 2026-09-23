import { File as NodeFile } from 'node:buffer';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
it('retires background uploads without sending requests or deleting queued files', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  const fetch = vi.fn();
  const handlers = new Map();
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('self', {
    addEventListener: (type, handler) => handlers.set(type, handler),
    clients: { matchAll: async () => [] },
    registration: { sync: { register: vi.fn() } }
  });
  const { createUploadRepository, UPLOAD_WAKE_MESSAGE, UPLOAD_SYNC_TAG } = await import('./wallUploadQueueCore.js');
  const repository = createUploadRepository();
  await repository.put({ id: 'saved-video', createdAt: 1, index: 0, name: 'phone.mp4', type: 'video/mp4', size: 5, persistent: true, status: 'pending', options: {} }, new NodeFile(['video'], 'phone.mp4'));
  await import('./wallUploadWorker.js');
  const work = [];
  const waitUntil = task => work.push(task);
  handlers.get('message')?.({ data: { type: UPLOAD_WAKE_MESSAGE }, waitUntil });
  handlers.get('sync')?.({ tag: UPLOAD_SYNC_TAG, waitUntil });
  await Promise.all(work);
  expect(fetch).not.toHaveBeenCalled();
  expect((await repository.list())[0].status).toBe('pending');
  expect((await repository.file('saved-video')).size).toBe(5);
});
