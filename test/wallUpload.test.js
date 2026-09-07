import {
  uploadWallFile,
  uploadObjectPart,
  wallRequest
} from '../webapp/src/features/flamingo/wallUpload.js';

describe('wall upload recovery', () => {
  test('object uploads resume only missing parts and acknowledge provider receipts before publication', async () => {
    const calls = [];
    const send = async (url, init) => {
      calls.push([url, init]);
      if (url.endsWith('/uploads'))
        return {
          uploadId: 'id',
          transport: 's3-multipart',
          chunkBytes: 4,
          receivedOffsets: [0]
        };
      if (url.endsWith('/sign'))
        return { url: 'https://bucket.test/signed-part' };
      if (url.endsWith('/complete')) return { post: { _id: 'post' } };
      return {};
    };
    const sendObjectPart = jest.fn(async () => 'provider-etag');
    const file = Object.assign(new Blob(['abcdefghij']), { name: 'video.mp4' });
    const result = await uploadWallFile({
      baseUrl: '',
      headers: { 'X-Wall-Owner-Token': 'owner' },
      file,
      uploadId: 'id',
      send,
      sendObjectPart
    });
    expect(result.post._id).toBe('post');
    expect(sendObjectPart).toHaveBeenCalledTimes(2);
    expect(await new Blob([sendObjectPart.mock.calls[0][1]]).text()).toBe(
      'efgh'
    );
    expect(
      calls
        .filter(([url]) => url.endsWith('/ack'))
        .map(([, init]) => JSON.parse(init.body))
    ).toEqual([{ etag: 'provider-etag' }, { etag: 'provider-etag' }]);
    expect(calls.at(-1)[0]).toMatch(/complete$/);
  });
  test('direct upload requests never forward wall credentials or cookies to the bucket', async () => {
    const request = jest.fn(
      async () =>
        new Response('', { status: 200, headers: { ETag: 'receipt' } })
    );
    expect(
      await uploadObjectPart('https://bucket.test/part', new Blob(['video']), {
        request
      })
    ).toBe('receipt');
    const init = request.mock.calls[0][1];
    expect(init.credentials).toBe('omit');
    expect(init.headers).toEqual({
      'Content-Type': 'application/octet-stream'
    });
  });
  test('restoration uses the resumable protocol and returns the original post id', async () => {
    const send = jest.fn(async (_url, init) => {
      expect(JSON.parse(init.body).restorePostId).toBe('existing-post');
      return { post: { _id: 'existing-post' } };
    });
    expect(
      await uploadWallFile({
        baseUrl: '',
        headers: {},
        file: Object.assign(new Blob(['video']), { name: 'original.mp4' }),
        uploadId: 'session',
        restorePostId: 'existing-post',
        send
      })
    ).toEqual({ post: { _id: 'existing-post' } });
    expect(send).toHaveBeenCalledTimes(1);
  });
  const makeFile = () =>
    Object.assign(new Blob(['abcdefghij'], { type: 'video/mp4' }), {
      name: 'phone.mp4'
    });
  test('resumes acknowledged ranges and sends the article in JSON, then completes once', async () => {
    const chunks = [];
    const progress = [];
    const article = 'ë'.repeat(8000);
    let metadata;
    let completions = 0;
    const send = async (url, init) => {
      if (init.method === 'POST' && !url.endsWith('/complete')) {
        metadata = JSON.parse(init.body);
        expect(init.headers['X-Upload-Id']).toBe('same-session');
        expect(init.headers['X-Upload-Text']).toBeUndefined();
        return {
          uploadId: 'same-session',
          chunkBytes: 4,
          receivedOffsets: [0]
        };
      }
      if (init.method === 'PUT') {
        chunks.push([
          init.headers['X-Upload-Offset'],
          await new Blob([init.body]).text()
        ]);
        return {};
      }
      completions += 1;
      return { post: { _id: 'published' } };
    };
    const result = await uploadWallFile({
      baseUrl: 'https://api.example',
      headers: {},
      file: makeFile(),
      uploadId: 'same-session',
      text: article,
      title: 'A full story',
      onProgress: (bytes, phase) => progress.push([bytes, phase]),
      send
    });
    expect(metadata.text).toBe(article);
    expect(metadata.title).toBe('A full story');
    expect(chunks).toEqual([
      ['4', 'efgh'],
      ['8', 'ij']
    ]);
    expect(progress[0]).toEqual([4, 'uploading']);
    expect(progress.at(-1)).toEqual([10, 'publishing']);
    expect(completions).toBe(1);
    expect(result.post._id).toBe('published');
  });

  test('a lost completion response returns the existing post without transferring bytes again', async () => {
    const send = jest.fn().mockResolvedValue({ post: { _id: 'already-live' } });
    const result = await uploadWallFile({
      baseUrl: '',
      headers: {},
      file: makeFile(),
      uploadId: 'stable-id',
      text: '',
      send
    });
    expect(result.post._id).toBe('already-live');
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('waits for other workers to stop and never publishes after a chunk fails', async () => {
    const calls = [];
    const send = async (url, init, options) => {
      calls.push(url);
      if (init.method === 'POST') return { uploadId: 'session', chunkBytes: 4 };
      if (init.headers['X-Upload-Offset'] === '0')
        throw new Error('Connection interrupted');
      await new Promise((resolve, reject) => {
        if (options.signal.aborted) return reject(new Error('Aborted'));
        options.signal.addEventListener(
          'abort',
          () => reject(new Error('Aborted')),
          { once: true }
        );
      });
    };
    await expect(
      uploadWallFile({
        baseUrl: '',
        headers: {},
        file: makeFile(),
        uploadId: 'session',
        text: '',
        send
      })
    ).rejects.toThrow('Connection interrupted');
    expect(calls.some((url) => url.endsWith('/complete'))).toBe(false);
  });

  test.each([
    ['4g', { effectiveType: '4g' }, 8, 3],
    ['unknown WebView', null, undefined, 2],
    ['data saver', { effectiveType: '4g', saveData: true }, 8, 1],
    ['3g', { effectiveType: '3g' }, 8, 1],
    ['2g', { effectiveType: '2g' }, 8, 1],
    ['slow 2g', { effectiveType: 'slow-2g' }, 8, 1],
    ['low memory', { effectiveType: '4g' }, 2, 1]
  ])(
    'bounds video requests on %s phones',
    async (_name, connection, deviceMemory, expectedPeak) => {
      let active = 0;
      let peak = 0;
      const offsets = [];
      const send = async (url, init) => {
        if (init.method === 'POST' && !url.endsWith('/complete'))
          return { uploadId: 'mobile-session', chunkBytes: 4 };
        if (init.method === 'PUT') {
          active += 1;
          peak = Math.max(peak, active);
          offsets.push(init.headers['X-Upload-Offset']);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
          return {};
        }
        return { post: { _id: 'published' } };
      };
      await uploadWallFile({
        baseUrl: '',
        headers: {},
        file: makeFile(),
        uploadId: 'mobile-session',
        text: '',
        connection,
        deviceMemory,
        send
      });
      expect(offsets).toEqual(['0', '4', '8']);
      expect(peak).toBe(expectedPeak);
    }
  );

  test('limits larger chunks to a small in-flight byte budget', async () => {
    const chunkBytes = 8 * 1024 ** 2;
    let activeBytes = 0;
    let peakBytes = 0;
    const file = Object.assign(new Blob([new Uint8Array(chunkBytes * 4)]), {
      name: 'large-video.mp4'
    });
    const send = async (url, init) => {
      if (url.endsWith('/uploads')) return { uploadId: 'id', chunkBytes };
      if (init.method === 'PUT') {
        activeBytes += init.body.byteLength;
        peakBytes = Math.max(peakBytes, activeBytes);
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeBytes -= init.body.byteLength;
      }
      return {};
    };
    await uploadWallFile({
      baseUrl: '',
      headers: {},
      file,
      uploadId: 'id',
      connection: { effectiveType: '4g' },
      deviceMemory: 8,
      send
    });
    expect(peakBytes).toBe(16 * 1024 ** 2);
  });

  test('drains parallel requests after a retry and finishes remaining ranges serially', async () => {
    const pending = new Map();
    const offsets = [];
    const progress = [];
    let completions = 0;
    const send = async (url, init, options) => {
      if (url.endsWith('/uploads')) return { uploadId: 'id', chunkBytes: 4 };
      if (init.method === 'PUT') {
        const offset = Number(init.headers['X-Upload-Offset']);
        offsets.push(offset);
        await new Promise((resolve) => {
          pending.set(offset, {
            resolve: () => {
              pending.delete(offset);
              resolve();
            },
            options
          });
        });
        return {};
      }
      completions += 1;
      return { post: { _id: 'post' } };
    };
    const upload = uploadWallFile({
      baseUrl: '',
      headers: {},
      uploadId: 'id',
      file: Object.assign(new Blob(['abcdefghijklmnopqrstuvwx']), {
        name: 'video.mp4'
      }),
      connection: { effectiveType: '4g' },
      deviceMemory: 8,
      send,
      onProgress: (bytes) => progress.push(bytes)
    });
    const settle = () => new Promise((resolve) => setImmediate(resolve));
    await settle();
    expect(offsets).toEqual([0, 4, 8]);
    pending.get(4).options.onRetry(new Error('Connection interrupted'), 1);
    pending.get(8).resolve();
    pending.get(4).resolve();
    await settle();
    expect(offsets).toEqual([0, 4, 8]);
    for (const offset of [0, 12, 16, 20]) {
      expect([...pending.keys()]).toEqual([offset]);
      pending.get(offset).resolve();
      await settle();
    }
    expect(await upload).toEqual({ post: { _id: 'post' } });
    expect(offsets).toEqual([0, 4, 8, 12, 16, 20]);
    expect(progress).toEqual([0, 4, 8, 12, 16, 20, 24, 24]);
    expect(completions).toBe(1);
  });

  test('sends materialized bytes and explicit MIME metadata without uploading a file-backed fetch body', async () => {
    const file = Object.assign(new Blob(['abcdefghij']), { name: 'phone.mp4' });
    const chunks = [];
    const send = async (url, init) => {
      if (url.endsWith('/uploads')) {
        expect(JSON.parse(init.body)).toMatchObject({
          name: 'phone.mp4',
          type: 'video/mp4',
          size: 10
        });
        return { uploadId: 'id', chunkBytes: 4 };
      }
      if (init.method === 'PUT') {
        // The Android regression happens before the server receives a range.
        if (init.body instanceof Blob) throw new TypeError('Failed to fetch');
        expect(init.body).toBeInstanceOf(ArrayBuffer);
        chunks.push([
          Number(init.headers['X-Upload-Offset']),
          Buffer.from(init.body).toString()
        ]);
        return {};
      }
      return { post: { _id: 'published' } };
    };
    expect(
      await uploadWallFile({
        baseUrl: '',
        headers: {},
        uploadId: 'id',
        file,
        type: 'video/mp4',
        send
      })
    ).toEqual({ post: { _id: 'published' } });
    expect(chunks.sort((a, b) => a[0] - b[0])).toEqual([
      [0, 'abcd'],
      [4, 'efgh'],
      [8, 'ij']
    ]);
  });

  describe('phone FileReader compatibility', () => {
    let originalFileReader;
    beforeEach(() => {
      originalFileReader = Object.getOwnPropertyDescriptor(
        globalThis,
        'FileReader'
      );
    });
    afterEach(() => {
      if (originalFileReader)
        Object.defineProperty(globalThis, 'FileReader', originalFileReader);
      else delete globalThis.FileReader;
    });

    const installReader = (read) => {
      const readers = [];
      globalThis.FileReader = class {
        readyState = 0;
        constructor() {
          readers.push(this);
        }
        readAsArrayBuffer(chunk) {
          this.readyState = 1;
          read(this, chunk);
        }
        abort = jest.fn(() => {
          this.readyState = 2;
          this.onabort?.();
        });
      };
      return readers;
    };
    const makeProviderFile = (method = 'rejected') => {
      const source = makeFile();
      return {
        name: source.name,
        type: source.type,
        size: source.size,
        slice: jest.fn((start, end) => {
          const chunk = source.slice(start, end);
          chunk.arrayBuffer =
            method === 'missing'
              ? undefined
              : jest.fn(async () => {
                  throw new DOMException(
                    'Blob read failed.',
                    'NotReadableError'
                  );
                });
          return chunk;
        })
      };
    };

    test.each(['missing', 'rejected'])(
      'reads only missing bounded ranges through FileReader when arrayBuffer is %s',
      async (method) => {
        const file = makeProviderFile(method);
        const ranges = [];
        const readers = installReader((reader, chunk) => {
          ranges.push(chunk.size);
          Blob.prototype.arrayBuffer.call(chunk).then((result) => {
            reader.result = result;
            reader.readyState = 2;
            reader.onload();
          });
        });
        const uploaded = [];
        const send = jest.fn(async (url, init) => {
          if (url.endsWith('/uploads'))
            return { uploadId: 'id', chunkBytes: 4, receivedOffsets: [0] };
          if (init.method === 'PUT') {
            expect(init.body).toBeInstanceOf(ArrayBuffer);
            uploaded.push([
              init.headers['X-Upload-Offset'],
              Buffer.from(init.body).toString()
            ]);
            return {};
          }
          return { post: { _id: 'published' } };
        });
        await expect(
          uploadWallFile({
            baseUrl: '',
            headers: {},
            uploadId: 'id',
            file,
            send
          })
        ).resolves.toEqual({ post: { _id: 'published' } });
        expect(file.slice.mock.calls).toEqual([
          [4, 8],
          [8, 10]
        ]);
        expect(ranges).toEqual([4, 2]);
        expect(uploaded).toEqual([
          ['4', 'efgh'],
          ['8', 'ij']
        ]);
        expect(readers).toHaveLength(2);
        for (const reader of readers) {
          expect(reader.onload).toBeNull();
          expect(reader.onerror).toBeNull();
          expect(reader.onabort).toBeNull();
          expect(reader.abort).not.toHaveBeenCalled();
        }
      }
    );

    test('keeps successful arrayBuffer reads on the original path', async () => {
      globalThis.FileReader = jest.fn();
      const send = jest.fn(async () => ({ uploadId: 'id', chunkBytes: 4 }));
      await uploadWallFile({
        baseUrl: '',
        headers: {},
        uploadId: 'id',
        file: makeFile(),
        send
      });
      expect(globalThis.FileReader).not.toHaveBeenCalled();
    });

    test.each(['error', 'incomplete', 'throws'])(
      'stops after a FileReader %s without sending or publishing bytes',
      async (kind) => {
        const readers = installReader((reader) => {
          if (kind === 'throws') throw new Error('Provider access expired.');
          queueMicrotask(() => {
            reader.readyState = 2;
            if (kind === 'error') {
              reader.error = new DOMException(
                'Access expired.',
                'NotReadableError'
              );
              reader.onerror();
            } else {
              reader.result = new ArrayBuffer(0);
              reader.onload();
            }
          });
        });
        const file = makeProviderFile();
        file.size = 4;
        const send = jest.fn(async () => ({ uploadId: 'id', chunkBytes: 4 }));
        await expect(
          uploadWallFile({
            baseUrl: '',
            headers: {},
            uploadId: 'id',
            file,
            send
          })
        ).rejects.toMatchObject({
          code: 'WALL_FILE_UNREADABLE',
          retryable: false
        });
        expect(send).toHaveBeenCalledTimes(1);
        expect(readers).toHaveLength(1);
        expect(readers[0].onload).toBeNull();
        expect(readers[0].onerror).toBeNull();
        expect(readers[0].onabort).toBeNull();
      }
    );

    test('aborts an active fallback reader and clears its handlers', async () => {
      const controller = new AbortController();
      let start;
      const started = new Promise((resolve) => {
        start = resolve;
      });
      const readers = installReader(() => start());
      const file = makeProviderFile();
      file.size = 4;
      const send = jest.fn(async () => ({ uploadId: 'id', chunkBytes: 4 }));
      const upload = uploadWallFile({
        baseUrl: '',
        headers: {},
        uploadId: 'id',
        file,
        signal: controller.signal,
        send
      });
      await started;
      controller.abort();
      await expect(upload).rejects.toMatchObject({ name: 'AbortError' });
      expect(send).toHaveBeenCalledTimes(1);
      expect(readers[0].abort).toHaveBeenCalledTimes(1);
      expect(readers[0].onload).toBeNull();
      expect(readers[0].onerror).toBeNull();
      expect(readers[0].onabort).toBeNull();
    });
  });

  test.each(['unreadable', 'incomplete'])(
    'reports an %s phone file instead of a connection failure',
    async (kind) => {
      const file = {
        name: 'phone.mp4',
        type: 'video/mp4',
        size: 4,
        slice: () => ({
          arrayBuffer: async () => {
            if (kind === 'unreadable')
              throw new DOMException(
                'Permission to the selected file expired.',
                'NotReadableError'
              );
            return new ArrayBuffer(0);
          }
        })
      };
      const send = jest.fn(async () => ({ uploadId: 'id', chunkBytes: 4 }));
      await expect(
        uploadWallFile({ baseUrl: '', headers: {}, uploadId: 'id', file, send })
      ).rejects.toMatchObject({
        code: 'WALL_FILE_UNREADABLE',
        retryable: false,
        message: expect.stringContaining('select it again')
      });
      expect(send).toHaveBeenCalledTimes(1);
    }
  );

  test('pausing during a phone file read stops without sending or publishing bytes', async () => {
    const controller = new AbortController();
    let reading;
    const started = new Promise((resolve) => {
      reading = resolve;
    });
    const file = {
      name: 'phone.mp4',
      type: 'video/mp4',
      size: 4,
      slice: () => ({
        arrayBuffer: () => {
          reading();
          return new Promise(() => {});
        }
      })
    };
    const send = jest.fn(async () => ({ uploadId: 'id', chunkBytes: 4 }));
    const upload = uploadWallFile({
      baseUrl: '',
      headers: {},
      uploadId: 'id',
      file,
      signal: controller.signal,
      send
    });
    await started;
    controller.abort();
    await expect(upload).rejects.toMatchObject({ name: 'AbortError' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('retries transient server failures but preserves actionable storage errors', async () => {
    const response = (status, error) => ({
      status,
      ok: status === 200,
      json: async () => ({
        error,
        post: status === 200 ? { _id: 'ok' } : undefined
      })
    });
    const request = jest
      .fn()
      .mockResolvedValueOnce(response(503, 'Storage unavailable'))
      .mockResolvedValueOnce(response(200));
    const onRetry = jest.fn();
    await expect(
      wallRequest('/upload', {}, { request, onRetry, delay: async () => {} })
    ).resolves.toMatchObject({ post: { _id: 'ok' } });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ status: 503 }),
      1
    );
    const denied = jest
      .fn()
      .mockResolvedValue(
        response(403, 'This upload belongs to another session.')
      );
    await expect(
      wallRequest('/upload', {}, { request: denied, delay: async () => {} })
    ).rejects.toThrow('another session');
    expect(denied).toHaveBeenCalledTimes(1);
  });

  test.each([
    [507, { error: 'The post database is full.', code: 'WALL_DATABASE_QUOTA' }],
    [503, { error: 'Media storage is unavailable.', retryable: false }]
  ])(
    'does not repeat uploads for a non-retryable storage failure (%s)',
    async (status, payload) => {
      const request = jest.fn(async () => ({
        status,
        ok: false,
        json: async () => payload
      }));
      const delay = jest.fn();
      await expect(
        wallRequest('/upload', {}, { request, delay })
      ).rejects.toMatchObject({ message: payload.error, status });
      expect(request).toHaveBeenCalledTimes(1);
      expect(delay).not.toHaveBeenCalled();
    }
  );
});
