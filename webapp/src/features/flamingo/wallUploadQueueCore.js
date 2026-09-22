import { uploadWallFile } from './wallUpload.js';
export const MAX_UPLOAD_FILES = 30;
export const MAX_UPLOAD_BYTES = 5 * 1024 ** 3;
export const UPLOAD_CONCURRENCY = 5;
export const UPLOAD_SYNC_TAG = 'tonplaygram-wall-uploads';
const LEASE_MS = 45_000;
export function validateUploadBatch(files) {
  if (!files.length || files.length > MAX_UPLOAD_FILES)
    throw new Error('Select between 1 and 30 files.');
  if (files.some((file) => !file.size || file.size > MAX_UPLOAD_BYTES))
    throw new Error('Each file must be non-empty and no larger than 5 GB.');
}

// Metadata and file bodies are separate: listing a 30-video queue never loads
// the videos into memory. Only the five claimed jobs open their file blobs.
export function createUploadRepository(indexedDB = globalThis.indexedDB) {
  let opening;
  function open() {
    if (!opening)
      opening = new Promise((resolve, reject) => {
        if (!indexedDB)
          return reject(
            new Error('Saved uploads are unavailable in this browser.')
          );
        const request = indexedDB.open('tonplaygram-wall-uploads', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('jobs', { keyPath: 'id' });
          request.result.createObjectStore('files');
        };
        request.onsuccess = () => {
          request.result.onversionchange = () => {
            request.result.close();
            opening = undefined;
          };
          resolve(request.result);
        };
        request.onerror = () => {
          opening = undefined;
          reject(request.error);
        };
      });
    return opening;
  }
  const requestValue = (request) =>
    new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  async function transaction(stores, mode, work) {
    const database = await open();
    const tx = database.transaction(stores, mode);
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () =>
        reject(tx.error || new Error('Upload storage is full or unavailable.'));
      tx.onerror = () => {};
    });
    try {
      const result = await work(tx);
      await done;
      return result;
    } catch (error) {
      try {
        tx.abort();
      } catch {}
      await done.catch(() => {});
      throw error;
    }
  }
  const jobs = (mode, work) =>
    transaction(['jobs'], mode, (tx) => work(tx.objectStore('jobs')));
  return {
    list: () => jobs('readonly', (store) => requestValue(store.getAll())),
    file: (id) =>
      transaction(['files'], 'readonly', (tx) =>
        requestValue(tx.objectStore('files').get(id))
      ),
    put: (job, file) =>
      transaction(file ? ['jobs', 'files'] : ['jobs'], 'readwrite', (tx) => {
        tx.objectStore('jobs').put(job);
        if (file) tx.objectStore('files').put(file, job.id);
      }),
    activate: (ids) =>
      jobs('readwrite', async (store) => {
        const rows = await requestValue(store.getAll());
        rows
          .filter((job) => ids.includes(job.id))
          .forEach((job) => store.put({ ...job, status: 'pending' }));
      }),
    removeFile: (id) =>
      transaction(['files'], 'readwrite', (tx) => {
        tx.objectStore('files').delete(id);
      }),
    remove: (id) =>
      transaction(['files', 'jobs'], 'readwrite', (tx) => {
        tx.objectStore('files').delete(id);
        tx.objectStore('jobs').delete(id);
      }),
    change: (id, mutate) =>
      jobs('readwrite', async (store) => {
        const job = await requestValue(store.get(id));
        if (!job) return;
        const next = mutate(job);
        if (next) store.put(next);
        return next;
      }),
    claim: (owner, now = Date.now(), persistentOnly = false) =>
      jobs('readwrite', async (store) => {
        const rows = await requestValue(store.getAll());
        // This count and claim happen in one read/write transaction across tabs
        // and the service worker. There can never be more than five live leases.
        if (
          rows.filter((job) => job.leaseUntil > now).length >=
          UPLOAD_CONCURRENCY
        )
          return;
        const next = rows
          .sort((a, b) => a.createdAt - b.createdAt || a.index - b.index)
          .find(
            (job) =>
              ['pending', 'uploading'].includes(job.status) &&
              (!persistentOnly || job.persistent) &&
              !(job.retryAt > now) &&
              !(job.leaseUntil > now)
          );
        if (!next) return;
        const claimed = {
          ...next,
          status: 'uploading',
          leaseOwner: owner,
          leaseUntil: now + LEASE_MS,
          error: ''
        };
        store.put(claimed);
        return claimed;
      })
  };
}

// Shared by the foreground and bundled service worker. Each retry uses the
// existing server upload id and acknowledged offsets, including after restart.
export function createUploadRunner({
  repository,
  upload = uploadWallFile,
  fileFor = (job) => repository.file(job.id),
  changed = () => {},
  published = () => {},
  background = false
}) {
  const owner =
    globalThis.crypto?.randomUUID?.() ||
    `runner-${Date.now()}-${Math.random()}`;
  const controllers = new Map();
  let running;
  let stopping = false;
  async function process(job) {
    const controller = new AbortController();
    controllers.set(job.id, controller);
    let bytes = job.bytes || 0,
      phase = 'uploading';
    let beatBusy = false;
    const heartbeat = async () => {
      if (beatBusy) return;
      beatBusy = true;
      try {
        const next = await repository.change(job.id, (current) => {
          if (current.leaseOwner !== owner || current.status !== 'uploading') {
            controller.abort();
            return;
          }
          return {
            ...current,
            bytes,
            phase,
            leaseUntil: Date.now() + LEASE_MS
          };
        });
        if (!next) controller.abort();
        changed();
      } catch {
        controller.abort();
      } finally {
        beatBusy = false;
      }
    };
    const timer = setInterval(heartbeat, 2000);
    try {
      const stored = await fileFor(job);
      if (!stored)
        throw Object.assign(
          new Error('Choose this file again to resume its saved upload.'),
          { code: 'WALL_FILE_UNREADABLE' }
        );
      const file = stored.name
        ? stored
        : new File([stored], job.name, {
            type: job.type,
            lastModified: job.lastModified
          });
      const result = await upload({
        ...job.options,
        file,
        uploadId: job.id,
        signal: controller.signal,
        // Five videos in parallel, with one bounded chunk per video.
        connection: { saveData: true },
        onProgress: (value, nextPhase) => {
          bytes = value;
          phase = nextPhase;
        }
      });
      if (!result.post?._id)
        throw new Error(
          'Publication was not confirmed. Resume to check this upload.'
        );
      await repository.change(job.id, (current) =>
        current.leaseOwner === owner
          ? {
              ...current,
              status: 'complete',
              bytes: job.size,
              phase: 'complete',
              leaseUntil: 0,
              error: '',
              options: { ...current.options, headers: {} }
            }
          : undefined
      );
      await repository.removeFile(job.id);
      published(result.post);
    } catch (error) {
      await repository.change(job.id, (current) => {
        if (current.leaseOwner !== owner) return;
        const interrupted = controller.signal.aborted;
        const unreadable = error.code === 'WALL_FILE_UNREADABLE';
        const retry = !unreadable && !error.status && error.retryable !== false;
        return {
          ...current,
          leaseUntil: 0,
          status:
            current.status !== 'uploading'
              ? current.status
              : unreadable
                ? 'needs-file'
                : interrupted || retry
                  ? 'pending'
                  : 'error',
          retryAt: interrupted ? 0 : Date.now() + 30_000,
          error: interrupted
            ? ''
            : error.message || 'Upload interrupted. Please resume.'
        };
      });
    } finally {
      clearInterval(timer);
      controllers.delete(job.id);
      changed();
    }
  }
  return {
    abort: (id) => controllers.get(id)?.abort(),
    stop: () => {
      stopping = true;
      controllers.forEach((controller) => controller.abort());
    },
    run: ({ deadline = Infinity } = {}) => {
      if (running) return running;
      stopping = false;
      running = Promise.all(
        Array.from({ length: UPLOAD_CONCURRENCY }, async () => {
          while (
            !stopping &&
            Date.now() < deadline &&
            globalThis.navigator?.onLine !== false
          ) {
            const job = await repository.claim(owner, Date.now(), background);
            if (!job) break;
            changed();
            await process(job);
          }
        })
      ).finally(() => {
        running = undefined;
      });
      return running;
    }
  };
}
