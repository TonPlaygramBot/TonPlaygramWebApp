import { File as NodeFile } from 'node:buffer';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import {
  createUploadRepository,
  createUploadRunner,
  validateUploadBatch,
  MAX_UPLOAD_BYTES
} from './wallUploadQueueCore.js';
const deferred = () => {
  let resolve!: (value?: any) => void;
  const promise = new Promise<any>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
async function setup(count = 1) {
  const factory = new IDBFactory();
  const repository = createUploadRepository(factory);
  for (let i = 0; i < count; i++) {
    const file = new NodeFile(['video'], `video-${i}.mp4`, {
      type: 'video/mp4',
      lastModified: 10
    });
    await repository.put(
      {
        id: `job-${i}`,
        createdAt: 1,
        index: i,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: 10,
        status: 'pending',
        persistent: true,
        options: {
          headers: { 'X-Wall-Owner-Token': 'original-owner' },
          premium: false,
          priceTpg: 0
        }
      },
      file
    );
  }
  return { factory, repository };
}
describe('durable wall upload queue', () => {
  it('accepts 30 files of 5 GB each and rejects 31 or an oversized file', () => {
    expect(() =>
      validateUploadBatch(
        Array.from({ length: 30 }, () => ({ size: MAX_UPLOAD_BYTES }))
      )
    ).not.toThrow();
    expect(() =>
      validateUploadBatch(Array.from({ length: 31 }, () => ({ size: 1 })))
    ).toThrow('30');
    expect(() => validateUploadBatch([{ size: MAX_UPLOAD_BYTES + 1 }])).toThrow(
      '5 GB'
    );
    expect(() => validateUploadBatch([{ size: 0 }])).toThrow();
  });
  it('enforces five active uploads across independent foreground/worker runners and completes all 30 once', async () => {
    const { repository } = await setup(30);
    const gate = deferred();
    let active = 0,
      max = 0;
    const ids: string[] = [];
    const upload = vi.fn(async ({ uploadId, file, headers }) => {
      active++;
      max = Math.max(max, active);
      ids.push(uploadId);
      expect(file.size).toBe(5);
      expect(file.name).toMatch(/video-/);
      expect(headers['X-Wall-Owner-Token']).toBe('original-owner');
      await gate.promise;
      active--;
      return { post: { _id: uploadId } };
    });
    const a = createUploadRunner({ repository, upload });
    const b = createUploadRunner({ repository, upload });
    const work = Promise.all([a.run(), b.run()]);
    await vi.waitFor(() => expect(active).toBe(5));
    expect(upload).toHaveBeenCalledTimes(5);
    gate.resolve();
    await work;
    expect(max).toBe(5);
    expect(new Set(ids).size).toBe(30);
    const saved = await repository.list();
    expect(saved.every((job) => job.status === 'complete')).toBe(true);
    expect(
      saved.every((job) => Object.keys(job.options.headers).length === 0)
    ).toBe(true);
    expect(await repository.file('job-0')).toBeUndefined();
  });
  it('leaves files that could not be saved for the foreground uploader', async () => {
    const { repository } = await setup();
    await repository.change('job-0', (job) => ({ ...job, persistent: false }));
    const upload = vi.fn();
    await createUploadRunner({ repository, upload, background: true }).run();
    expect(upload).not.toHaveBeenCalled();
    expect((await repository.list())[0].status).toBe('pending');
  });
  it('reopens the database, recovers an expired lease with the same upload id, and skips completed jobs', async () => {
    const { repository, factory } = await setup(2);
    await repository.change('job-0', (job) => ({
      ...job,
      status: 'uploading',
      bytes: 3,
      leaseOwner: 'closed-browser',
      leaseUntil: Date.now() - 1
    }));
    await repository.change('job-1', (job) => ({ ...job, status: 'complete' }));
    const reopened = createUploadRepository(factory);
    const upload = vi.fn(async () => ({ post: { _id: 'saved-post' } }));
    await createUploadRunner({ repository: reopened, upload }).run();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0]).toMatchObject({
      uploadId: 'job-0',
      premium: false,
      priceTpg: 0
    });
    expect((await reopened.list())[0].status).toBe('complete');
  });
  it('keeps other videos moving if one file is unavailable, while preserving that job for re-selection', async () => {
    const { repository } = await setup(6);
    await repository.removeFile('job-0');
    const upload = vi.fn(async ({ uploadId }) => ({ post: { _id: uploadId } }));
    await createUploadRunner({ repository, upload }).run();
    const saved = await repository.list();
    expect(saved.find((job) => job.id === 'job-0').status).toBe('needs-file');
    expect(saved.filter((job) => job.status === 'complete')).toHaveLength(5);
  });
  it('does not restart paused uploads and preserves files after pause or temporary connection loss', async () => {
    const { repository } = await setup(2);
    await repository.change('job-0', (job) => ({ ...job, status: 'paused' }));
    const upload = vi.fn(async () => {
      throw new Error('offline');
    });
    await createUploadRunner({ repository, upload }).run();
    const saved = await repository.list();
    expect(saved[0].status).toBe('paused');
    expect(saved[1].status).toBe('pending');
    expect(saved[1].retryAt).toBeGreaterThan(Date.now());
    expect(await repository.file('job-1')).toBeDefined();
    expect(upload).toHaveBeenCalledTimes(1);
  });
  it('aborts in-flight work on pause and resumes with its original id', async () => {
    const { repository } = await setup();
    const started = deferred();
    const first = createUploadRunner({
      repository,
      upload: async ({ signal }) => {
        started.resolve();
        await new Promise((_, reject) =>
          signal.addEventListener('abort', () =>
            reject(new DOMException('paused', 'AbortError'))
          )
        );
      }
    });
    const work = first.run();
    await started.promise;
    await repository.change('job-0', (job) => ({ ...job, status: 'paused' }));
    first.abort('job-0');
    await work;
    expect((await repository.list())[0].status).toBe('paused');
    expect(await repository.file('job-0')).toBeDefined();
    await repository.change('job-0', (job) => ({ ...job, status: 'pending' }));
    const upload = vi.fn(async () => ({ post: { _id: 'confirmed' } }));
    await createUploadRunner({ repository, upload }).run();
    expect(upload.mock.calls[0][0].uploadId).toBe('job-0');
  });
  it('cancel removes the saved video and does not recreate its job when a request ends late', async () => {
    const { repository } = await setup();
    const started = deferred(),
      gate = deferred();
    const runner = createUploadRunner({
      repository,
      upload: async () => {
        started.resolve();
        await gate.promise;
        throw new Error('late failure');
      }
    });
    const work = runner.run();
    await started.promise;
    await repository.remove('job-0');
    runner.abort('job-0');
    gate.resolve();
    await work;
    expect(await repository.list()).toEqual([]);
    expect(await repository.file('job-0')).toBeUndefined();
  });
  it('retries reservation pressure and temporary HTTP failures without losing the file', async () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      const { repository } = await setup();
      const upload = vi.fn(async () => {
        throw Object.assign(new Error('Temporarily busy'), {
          status,
          retryable: true
        });
      });
      await createUploadRunner({ repository, upload }).run();
      expect((await repository.list())[0]).toMatchObject({ status: 'pending' });
      expect((await repository.list())[0].retryAt).toBeGreaterThan(Date.now());
      expect(await repository.file('job-0')).toBeDefined();
    }
    const { repository } = await setup();
    await createUploadRunner({
      repository,
      upload: async () => {
        throw Object.assign(new Error('Server full'), {
          status: 507,
          code: 'WALL_DISK_FULL',
          retryable: false
        });
      }
    }).run();
    expect((await repository.list())[0]).toMatchObject({
      status: 'error',
      errorCode: 'WALL_DISK_FULL'
    });
  });
  it('hands saved work to a worker immediately, preserving acknowledged progress and owner headers', async () => {
    const { repository } = await setup();
    const started = deferred();
    let hidden = false;
    const foreground = createUploadRunner({
      repository,
      memoryOnly: () => hidden,
      upload: async ({ signal, onProgress }) => {
        onProgress(3, 'uploading');
        started.resolve();
        await new Promise((_, reject) =>
          signal.addEventListener('abort', () =>
            reject(new DOMException('Handoff', 'AbortError'))
          )
        );
      }
    });
    const work = foreground.run();
    await started.promise;
    hidden = true;
    await foreground.releaseSaved();
    const upload = vi.fn(async ({ uploadId, headers }) => {
      expect(headers['X-Wall-Owner-Token']).toBe('original-owner');
      return { post: { _id: uploadId } };
    });
    await createUploadRunner({ repository, upload, background: true }).run();
    await work;
    expect(upload).toHaveBeenCalledTimes(1);
    expect((await repository.list())[0].status).toBe('complete');
  });
  it('delivers a saved cancellation without needing the video bytes, also after a connection failure', async () => {
    const { repository } = await setup();
    await repository.change('job-0', (job) => ({
      ...job,
      operation: 'cancel'
    }));
    await repository.removeFile('job-0');
    const upload = vi.fn();
    const cancel = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ cancelled: true });
    const runner = createUploadRunner({
      repository,
      upload,
      cancel,
      background: true
    });
    await runner.run();
    expect((await repository.list())[0]).toMatchObject({
      status: 'pending',
      operation: 'cancel'
    });
    await repository.change('job-0', (job) => ({ ...job, retryAt: 0 }));
    await runner.run();
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(upload).not.toHaveBeenCalled();
    expect(await repository.list()).toEqual([]);
  });
});
