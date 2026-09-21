import {
  createUploadRepository,
  createUploadRunner,
  UPLOAD_SYNC_TAG
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
self.addEventListener('sync', (event) => {
  if (event.tag !== UPLOAD_SYNC_TAG) return;
  event.waitUntil(
    (async () => {
      // Browsers may kill long-running workers. Yield bounded work and retain
      // acknowledged chunks so a later sync or foreground visit can resume.
      const deadline = Date.now() + 25_000;
      const timer = setTimeout(() => runner.stop(), 25_000);
      try {
        await runner.run({ deadline });
      } finally {
        clearTimeout(timer);
      }
      const pending = (await repository.list()).some((job) =>
        ['pending', 'uploading'].includes(job.status)
      );
      if (pending)
        throw new Error('Uploads remain queued for background retry.');
    })()
  );
});
