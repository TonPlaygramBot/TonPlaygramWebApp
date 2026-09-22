import {
  createUploadRepository,
  createUploadRunner,
  validateUploadBatch,
  UPLOAD_SYNC_TAG,
  UPLOAD_WAKE_MESSAGE
} from './wallUploadQueueCore.js';
import { retainWallTransfer } from './wallTransferActivity.js';
const repository = createUploadRepository();
const retained = new Map();
const listeners = new Set();
let snapshot = [];
let channel;
let started = false;
let refreshing = false;
let workerRegistration;
let handingOff = false;
const runner = createUploadRunner({
  repository,
  memoryOnly: () => handingOff,
  fileFor: (job) => retained.get(job.id) || repository.file(job.id),
  changed: () => {
    void refresh();
    channel?.postMessage('changed');
  },
  published: (post) => {
    window.dispatchEvent(
      new CustomEvent('wall-upload-published', { detail: post })
    );
    channel?.postMessage('published');
  }
});
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    snapshot = (await repository.list()).sort(
      (a, b) => a.createdAt - b.createdAt || a.index - b.index
    );
    const active = new Set(
      snapshot.filter((job) => job.status !== 'complete').map((job) => job.id)
    );
    // A refresh may race a file being staged. Only release confirmed finished
    // files here; an absent row may still be inside its first write transaction.
    for (const job of snapshot)
      if (job.status === 'complete') retained.delete(job.id);
    retainWallTransfer('saved-wall-uploads', active.size > 0);
    listeners.forEach((listener) => listener());
  } catch {
  } finally {
    refreshing = false;
  }
}
async function backgroundSync() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration('/');
    workerRegistration = registration;
    await registration?.sync?.register(UPLOAD_SYNC_TAG);
  } catch {
    /* Unsupported WebViews still resume on the next app visit. */
  }
}
function handoff() {
  const worker = workerRegistration?.active;
  // Without a worker, keep the in-page upload alive for as long as the WebView
  // allows. Never abort simply because pagehide fired.
  if (!worker) {
    void backgroundSync();
    return;
  }
  try {
    worker.postMessage({ type: UPLOAD_WAKE_MESSAGE });
  } catch {
    void backgroundSync();
    return;
  }
  handingOff = true;
  void runner
    .releaseSaved()
    .catch(() => {})
    .finally(() => {
      try {
        worker.postMessage({ type: UPLOAD_WAKE_MESSAGE });
      } catch {}
      void backgroundSync();
    });
}
function kick() {
  void runner
    .run()
    .catch(() => {})
    .finally(refresh);
}
export function startWallUploadQueue() {
  if (started) return;
  started = true;
  if (typeof BroadcastChannel === 'function') {
    channel = new BroadcastChannel(UPLOAD_SYNC_TAG);
    channel.onmessage = (event) => {
      void refresh();
      if (event.data === 'published')
        window.dispatchEvent(new Event('wall-upload-published'));
    };
  }
  const restore = () => {
    void refresh();
    if (
      handingOff &&
      snapshot.some((job) => ['pending', 'uploading'].includes(job.status))
    )
      handoff();
    kick();
  };
  window.addEventListener('online', restore);
  window.addEventListener('pageshow', () => {
    handingOff = false;
    restore();
  });
  window.addEventListener('pagehide', handoff);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') handoff();
    else {
      handingOff = false;
      restore();
      void backgroundSync();
    }
  });
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    void backgroundSync().then(() => {
      if (document.visibilityState === 'hidden') handoff();
    });
  });
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'wall-upload-update') {
      void refresh();
    }
    if (event.data?.type === 'wall-upload-published')
      window.dispatchEvent(new Event('wall-upload-published'));
  });
  // Polling also observes service worker progress and expired leases after a
  // browser process was killed. No network request is made for an empty queue.
  setInterval(restore, 5000);
  void backgroundSync();
  void recoverStaging()
    .catch(() => {})
    .finally(restore);
}
async function recoverStaging() {
  // The previous release made reservation pressure a permanent failure. Retry
  // those saved jobs once using the new server admission policy.
  for (const job of await repository.list()) {
    if (
      job.status === 'error' &&
      job.error ===
        'There is not enough media storage for this upload. Your selection is kept; storage needs to be freed before retrying.'
    )
      await repository.change(job.id, (current) =>
        current.status === 'error'
          ? { ...current, status: 'pending', retryAt: 0, error: '' }
          : undefined
      );
  }
  if (!navigator.locks) return;
  await navigator.locks
    .request('wall-upload-staging', async () => {
      const staged = (await repository.list()).filter(
        (job) => job.status === 'staging'
      );
      if (staged.length) await repository.activate(staged.map((job) => job.id));
    })
    .catch(() => {});
}
export const getWallUploads = () => snapshot;
export const subscribeWallUploads = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export async function enqueueWallUploads(items, options) {
  validateUploadBatch(items.map((item) => item.file));
  startWallUploadQueue();
  if (navigator.locks)
    return navigator.locks.request('wall-upload-staging', () =>
      saveBatch(items, options)
    );
  return saveBatch(items, options);
}
async function saveBatch(items, options) {
  const createdAt = Date.now();
  const accepted = [];
  let persistent = true;
  try {
    for (const [index, item] of items.entries()) {
      const { file, id, type, duration = 0 } = item;
      const job = {
        id,
        batchId: items[0].id,
        index,
        createdAt,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        type,
        bytes: 0,
        status: 'staging',
        persistent: true,
        leaseUntil: 0,
        options: { ...options, type, duration }
      };
      retained.set(id, file);
      try {
        await repository.put(job, file);
      } catch {
        job.persistent = false;
        persistent = false;
        await repository.put(job);
      }
      accepted.push(id);
    }
    await repository.activate(accepted);
  } catch (error) {
    // Roll back this batch before starting it; the composer still owns every
    // original selection, so a storage failure cannot silently drop videos.
    await Promise.all(accepted.map((id) => repository.remove(id)));
    items.forEach((item) => retained.delete(item.id));
    throw new Error(
      'Upload queue storage is unavailable. Free some device space and try again.'
    );
  }
  void navigator.storage?.persist?.().catch(() => false);
  await refresh();
  void backgroundSync();
  kick();
  window.dispatchEvent(new Event('wall-transfers-open'));
  return { persistent };
}
export async function setWallUploadStatus(id, status) {
  await repository.change(id, (job) => ({
    ...job,
    status,
    retryAt: 0,
    error: ''
  }));
  runner.abort(id);
  await refresh();
  channel?.postMessage('changed');
  if (status === 'pending') {
    void backgroundSync();
    kick();
  }
}
export async function dismissWallUpload(id) {
  const job = (await repository.list()).find((item) => item.id === id);
  if (!job) return;
  if (job.status === 'complete') await repository.remove(id);
  else
    await repository.change(id, (current) => ({
      ...current,
      operation: 'cancel',
      status: 'pending',
      retryAt: 0,
      error: ''
    }));
  runner.abort(id);
  if (job.status !== 'complete') await repository.removeFile(id);
  retained.delete(id);
  await refresh();
  channel?.postMessage('changed');
  void backgroundSync();
  kick();
}
export async function reselectWallUpload(id, file) {
  const job = (await repository.list()).find((job) => job.id === id);
  if (!job) return;
  if (
    file.name !== job.name ||
    file.size !== job.size ||
    file.lastModified !== job.lastModified
  )
    throw new Error(
      'Choose the same original file (same name, size and modification date) to resume safely.'
    );
  retained.set(id, file);
  const next = {
    ...job,
    status: 'pending',
    leaseUntil: 0,
    retryAt: 0,
    error: '',
    persistent: true
  };
  try {
    await repository.put(next, file);
  } catch {
    next.persistent = false;
    await repository.put(next);
  }
  await refresh();
  void backgroundSync();
  kick();
}
