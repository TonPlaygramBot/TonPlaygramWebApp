import {
  createUploadRepository,
  createUploadRunner,
  UPLOAD_SYNC_TAG,
  UPLOAD_WAKE_MESSAGE
} from './wallUploadQueueCore.js';
const repository = createUploadRepository();
const broadcast = (type) => {
  void self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) =>
      clients.forEach((client) => client.postMessage({ type }))
    );
};
const runner = createUploadRunner({
  repository,
  background: true,
  changed: () => broadcast('wall-upload-update'),
  published: () => broadcast('wall-upload-published')
});
let pumping;
const pendingJobs = async () =>
  (await repository.list()).filter(
    (job) =>
      (job.persistent || job.operation === 'cancel') &&
      ['pending', 'uploading'].includes(job.status)
  );
function continueUploads() {
  if (pumping) return pumping;
  pumping = (async () => {
    // The old 25-second cut-off could repeatedly abort the same slow chunk.
    // Allow a bounded sync window; checkpoints survive browser termination.
    const deadline = Date.now() + 4 * 60_000;
    const timer = setTimeout(() => runner.stop(), 4 * 60_000);
    try {
      do {
        await runner.run({ deadline });
        if (!(await pendingJobs()).length) return;
        // Wait for a foreground lease to be released/expire, or a transient
        // retry to become due. A second handoff message joins this same pump.
        if (Date.now() < deadline)
          await new Promise((resolve) => setTimeout(resolve, 2000));
      } while (Date.now() < deadline);
    } finally {
      clearTimeout(timer);
    }
    if ((await pendingJobs()).length) {
      await self.registration.sync?.register(UPLOAD_SYNC_TAG).catch(() => {});
      throw new Error('Uploads remain queued for background retry.');
    }
  })().finally(() => {
    pumping = undefined;
  });
  return pumping;
}
self.addEventListener('sync', (event) => {
  if (event.tag === UPLOAD_SYNC_TAG) event.waitUntil(continueUploads());
});
self.addEventListener('message', (event) => {
  // postMessage also works in browsers with service workers but no SyncManager.
  if (event.data?.type === UPLOAD_WAKE_MESSAGE)
    event.waitUntil(continueUploads().catch(() => {}));
});
