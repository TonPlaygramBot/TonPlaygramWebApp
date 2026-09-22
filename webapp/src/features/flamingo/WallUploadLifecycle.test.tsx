import { File as NodeFile } from 'node:buffer';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('./wallUpload.js', () => ({
  uploadWallFile: upload,
  cancelWallUpload: vi.fn()
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  upload.mockReset();
});

it('does not abort on pagehide without a worker, then hands off saved files when a worker becomes available', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('BroadcastChannel', undefined);
  vi.spyOn(globalThis, 'setInterval').mockReturnValue(1 as any);
  vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
  const listeners = vi.spyOn(window, 'addEventListener');
  const workerListeners = new Map();
  let registration;
  vi.stubGlobal('navigator', {
    onLine: true,
    serviceWorker: {
      getRegistration: async () => registration,
      addEventListener: (type, handler) => workerListeners.set(type, handler)
    }
  });
  let signal;
  upload.mockImplementation((options) => {
    signal = options.signal;
    return new Promise((_, reject) =>
      signal.addEventListener('abort', () =>
        reject(new DOMException('Handed off', 'AbortError'))
      )
    );
  });
  const queue = await import('./wallUploadQueue.js');
  await queue.enqueueWallUploads(
    [
      {
        id: 'phone-video',
        file: new NodeFile(['video'], 'phone.mp4'),
        type: 'video/mp4'
      }
    ],
    {}
  );
  await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
  const pagehide = listeners.mock.calls.find(
    ([name]) => name === 'pagehide'
  )[1] as () => void;
  pagehide();
  expect(signal.aborted).toBe(false);
  registration = { active: { postMessage: vi.fn() } };
  workerListeners.get('controllerchange')();
  await new Promise((resolve) => setTimeout(resolve, 0));
  pagehide();
  await vi.waitFor(() => expect(signal.aborted).toBe(true));
  expect(registration.active.postMessage).toHaveBeenCalledWith({
    type: 'wall-upload-run'
  });
  const { createUploadRepository } = await import('./wallUploadQueueCore.js');
  const repository = createUploadRepository();
  await vi.waitFor(async () =>
    expect((await repository.list())[0]).toMatchObject({
      status: 'pending',
      leaseUntil: 0
    })
  );
  expect(await repository.file('phone-video')).toBeDefined();
});
