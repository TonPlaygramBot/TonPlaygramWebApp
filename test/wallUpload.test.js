import {
  uploadWallFile,
  wallRequest
} from '../webapp/src/features/flamingo/wallUpload.js';

describe('wall upload recovery', () => {
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
        chunks.push([init.headers['X-Upload-Offset'], await init.body.text()]);
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
    await expect(
      wallRequest('/upload', {}, { request, delay: async () => {} })
    ).resolves.toMatchObject({ post: { _id: 'ok' } });
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
});
