import { File as NodeFile } from 'node:buffer';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('./wallUpload.js', () => ({
  uploadWallFile: upload,
  cancelWallUpload: vi.fn()
}));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
  upload.mockReset();
});

it('continues from a page message without SyncManager and allows a slow chunk to finish beyond 25 seconds', async () => {
  vi.useFakeTimers({
    toFake: [
      'Date',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval'
    ]
  });
  vi.stubGlobal('indexedDB', new IDBFactory());
  const handlers = new Map();
  vi.stubGlobal('self', {
    addEventListener: (type, handler) => handlers.set(type, handler),
    clients: { matchAll: async () => [] },
    registration: {}
  });
  const { createUploadRepository, UPLOAD_WAKE_MESSAGE } =
    await import('./wallUploadQueueCore.js');
  const repository = createUploadRepository();
  await repository.put(
    {
      id: 'saved-video',
      createdAt: 1,
      index: 0,
      name: 'phone.mp4',
      type: 'video/mp4',
      size: 5,
      persistent: true,
      status: 'pending',
      options: {}
    },
    new NodeFile(['video'], 'phone.mp4')
  );
  upload.mockImplementation(
    ({ signal }) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => resolve({ post: { _id: 'confirmed-post' } }),
          35_000
        );
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Interrupted', 'AbortError'));
        });
      })
  );
  await import('./wallUploadWorker.js');
  let lifetime;
  handlers.get('message')({
    data: { type: UPLOAD_WAKE_MESSAGE },
    waitUntil: (work) => {
      lifetime = work;
    }
  });
  await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
  await vi.advanceTimersByTimeAsync(36_000);
  await lifetime;
  expect(upload).toHaveBeenCalledTimes(1);
  expect((await repository.list())[0].status).toBe('complete');
  expect(await repository.file('saved-video')).toBeUndefined();
});
