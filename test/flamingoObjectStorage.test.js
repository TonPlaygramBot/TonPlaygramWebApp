import {
  createFlamingoObjectStorage,
  objectStorageConfig
} from '../bot/utils/flamingoObjectStorage.js';
import { createObjectUploads } from '../bot/services/flamingoObjectUploads.js';

const config = {
  endpoint: 'https://storage.example.test',
  region: 'auto',
  bucket: 'wall',
  credentials: {
    accessKeyId: 'EXAMPLE_ACCESS_KEY',
    secretAccessKey: 'EXAMPLE_SECRET_KEY'
  }
};
test('object storage requires a complete server-side connection', () => {
  expect(() => objectStorageConfig({})).toThrow('not connected');
  const env = {
    FLAMINGO_S3_ENDPOINT: config.endpoint,
    FLAMINGO_S3_BUCKET: config.bucket,
    FLAMINGO_S3_ACCESS_KEY_ID: 'test',
    FLAMINGO_S3_SECRET_ACCESS_KEY: 'test'
  };
  expect(objectStorageConfig(env).region).toBe('auto');
  expect(() =>
    objectStorageConfig({ ...env, FLAMINGO_S3_ENDPOINT: 'http://storage.test' })
  ).toThrow('connection');
});

test('signed upload tickets bind one part and its length without exposing the secret key', async () => {
  const store = createFlamingoObjectStorage({ config });
  const signed = new URL(
    await store.signPart(
      { key: 'wall/id/phone.mp4', bucket: 'wall', multipartId: 'multipart' },
      2,
      5242880
    )
  );
  expect(signed.searchParams.get('partNumber')).toBe('2');
  expect(signed.searchParams.get('uploadId')).toBe('multipart');
  expect(signed.searchParams.get('X-Amz-SignedHeaders')).toContain(
    'content-length'
  );
  expect(signed.searchParams.get('X-Amz-Expires')).toBe('900');
  expect(signed.href).not.toContain(config.credentials.secretAccessKey);
});

test('lists more than one page of completed parts and reads only the requested part when acknowledging', async () => {
  const client = {
    send: jest
      .fn()
      .mockResolvedValueOnce({
        Parts: [{ PartNumber: 1 }],
        IsTruncated: true,
        NextPartNumberMarker: 1000
      })
      .mockResolvedValueOnce({
        Parts: [{ PartNumber: 1001 }],
        IsTruncated: false
      })
      .mockResolvedValueOnce({
        Parts: [{ PartNumber: 5, Size: 12, ETag: 'etag' }]
      })
  };
  const store = createFlamingoObjectStorage({ config, client });
  const session = { key: 'video', bucket: 'wall', multipartId: 'upload' };
  expect((await store.parts(session)).map((p) => p.PartNumber)).toEqual([
    1, 1001
  ]);
  expect(client.send.mock.calls[1][0].input.PartNumberMarker).toBe(1000);
  expect(await store.part(session, 5)).toMatchObject({ PartNumber: 5 });
  expect(client.send.mock.calls[2][0].input).toMatchObject({
    PartNumberMarker: 4,
    MaxParts: 1
  });
});

test('provider authorization failures stay distinct from a missing object and are safe to display', async () => {
  const client = {
    send: jest
      .fn()
      .mockRejectedValueOnce({
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 }
      })
      .mockRejectedValueOnce({
        name: 'AccessDenied',
        message: 'private provider diagnostic',
        $metadata: { httpStatusCode: 403 }
      })
  };
  const store = createFlamingoObjectStorage({ config, client });
  expect(await store.head('missing')).toBeNull();
  await expect(store.head('private')).rejects.toMatchObject({
    code: 'WALL_OBJECT_STORAGE_UNAVAILABLE',
    retryable: false,
    status: 503
  });
});

test('a lost multipart completion response is recovered from the committed object', async () => {
  const client = {
    send: jest
      .fn()
      .mockRejectedValueOnce({ name: 'NotFound' })
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue({ ContentLength: 5 })
  };
  const store = createFlamingoObjectStorage({ config, client });
  expect(
    await store.complete(
      { key: 'video', bucket: 'wall', multipartId: 'upload' },
      [{ number: 1, etag: 'etag' }]
    )
  ).toMatchObject({ ContentLength: 5 });
  expect(client.send.mock.calls[1][0].constructor.name).toBe(
    'CompleteMultipartUploadCommand'
  );
});

test('cleanup aborts expired multipart uploads but never deletes completed originals awaiting recovery', async () => {
  const record = {
    _id: 'expired-session',
    key: 'wall/original',
    bucket: 'wall',
    updatedAt: new Date(Date.now() - 49 * 3600000)
  };
  const sessions = {
    find: () => ({ limit: () => ({ lean: async () => [record] }) }),
    findById: () => ({ lean: async () => record }),
    deleteOne: jest.fn()
  };
  const store = {
    abort: jest.fn(),
    head: jest.fn().mockResolvedValue({ ContentLength: 5 }),
    remove: jest.fn()
  };
  const uploads = createObjectUploads({ sessions, storage: () => store });
  await uploads.recover({
    isBusy: () => false,
    withLock: (_id, fn) => fn(),
    referenced: async () => false
  });
  expect(store.abort).toHaveBeenCalledTimes(1);
  expect(store.remove).not.toHaveBeenCalled();
  expect(sessions.deleteOne).not.toHaveBeenCalled();
  store.head.mockResolvedValue(null);
  await uploads.recover({
    isBusy: () => false,
    withLock: (_id, fn) => fn(),
    referenced: async () => false
  });
  expect(sessions.deleteOne).toHaveBeenCalledTimes(1);
});
