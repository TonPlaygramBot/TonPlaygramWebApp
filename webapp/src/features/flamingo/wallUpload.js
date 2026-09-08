// Upload state belongs to the selected file. Retrying uses the same session,
// skips acknowledged ranges, and never publishes the same file twice.
import { uploadNativeWallFile } from './wallNativeUpload.js';

const nativeFiles = new WeakSet();
export async function wallRequest(
  url,
  init = {},
  {
    signal = /** @type {AbortSignal | undefined} */ (undefined),
    attempts = 4,
    timeoutMs = 120_000,
    request = fetch,
    onRetry = (_error, _attempt) => {},
    delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  } = {}
) {
  let failure;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal?.aborted) throw new DOMException('Upload paused.', 'AbortError');
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await request(url, {
        ...init,
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;
      failure = Object.assign(
        new Error(
          payload.error || `Request failed (${response.status}). Please retry.`
        ),
        {
          status: response.status,
          code: payload.code,
          retryable: payload.retryable
        }
      );
      if (
        failure.retryable === false ||
        response.status === 507 ||
        (response.status < 500 && ![408, 429].includes(response.status))
      )
        throw failure;
    } catch (error) {
      if (signal?.aborted)
        throw new DOMException('Upload paused.', 'AbortError');
      if (
        error.retryable === false ||
        error.status === 507 ||
        (error.status &&
          error.status < 500 &&
          ![408, 429].includes(error.status))
      )
        throw error;
      failure = error.status
        ? error
        : new Error(
            'Connection interrupted. Resume your upload from Transfers anywhere in the app.'
          );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
    if (attempt + 1 < attempts) {
      onRetry(failure, attempt + 1);
      await delay(750 * 2 ** attempt);
    }
  }
  throw failure;
}

export async function uploadObjectPart(
  url,
  chunk,
  { signal, request = fetch, onRetry } = {}
) {
  const result = await wallRequest(
    url,
    {
      method: 'PUT',
      body: chunk,
      credentials: 'omit',
      headers: { 'Content-Type': 'application/octet-stream' }
    },
    {
      signal,
      onRetry,
      timeoutMs: 300_000,
      request: async (destination, init) => {
        const response = await request(destination, init);
        const etag = response.headers.get('etag');
        await response.body?.cancel?.();
        return {
          ok: response.ok,
          status: response.status,
          json: async () => ({
            etag,
            error:
              'Media upload interrupted. Keep your file selected and retry.'
          })
        };
      }
    }
  );
  if (!result.etag)
    throw new Error(
      'The upload could not be confirmed. Keep your file selected and retry.'
    );
  return result.etag;
}

function readWithFileReader(chunk, signal) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const cleanup = () => {
      reader.onload = reader.onerror = reader.onabort = null;
      signal.removeEventListener('abort', abort);
    };
    const finish = (settle, value) => {
      cleanup();
      settle(value);
    };
    const abort = () => {
      cleanup();
      if (reader.readyState === 1) reader.abort();
      reject(new DOMException('Upload paused.', 'AbortError'));
    };
    reader.onload = () => finish(resolve, reader.result);
    reader.onerror = () => finish(reject, reader.error);
    reader.onabort = () =>
      finish(reject, new DOMException('Upload paused.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) return abort();
    try {
      reader.readAsArrayBuffer(chunk);
    } catch (error) {
      finish(reject, error);
    }
  });
}

async function readUploadBytes(file, offset, end, signal) {
  if (signal.aborted) throw new DOMException('Upload paused.', 'AbortError');
  // Android content-provider Files can be readable by the File API while a
  // fetch with a file-backed Blob body fails before sending any bytes. Keep
  // the original picker File and materialize only this bounded range.
  let abort;
  try {
    const chunk = file.slice(offset, end);
    const reading = Promise.resolve()
      .then(() => {
        if (signal.aborted)
          throw new DOMException('Upload paused.', 'AbortError');
        return chunk.arrayBuffer();
      })
      .catch((error) => {
        if (signal.aborted)
          throw new DOMException('Upload paused.', 'AbortError');
        if (typeof globalThis.FileReader !== 'function') throw error;
        // Some phone WebViews expose a FileReader path even when the newer
        // Blob method is unavailable or fails. Retry this range once only.
        return readWithFileReader(chunk, signal);
      });
    const bytes = await Promise.race([
      reading,
      new Promise((_resolve, reject) => {
        abort = () => reject(new DOMException('Upload paused.', 'AbortError'));
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      })
    ]);
    if (bytes.byteLength !== end - offset)
      throw new Error('Incomplete file read.');
    return bytes;
  } catch (error) {
    if (signal.aborted) throw new DOMException('Upload paused.', 'AbortError');
    throw Object.assign(
      new Error(
        'This file could not be read. Save a copy on your phone and select it again.'
      ),
      { code: 'WALL_FILE_UNREADABLE', retryable: false, cause: error }
    );
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
  }
}

export async function uploadWallFile({
  baseUrl,
  headers,
  file,
  type = file.type,
  uploadId,
  text,
  title,
  duration = 0,
  premium = false,
  priceTpg = 0,
  restorePostId = undefined,
  signal,
  connection = globalThis.navigator?.connection,
  deviceMemory = globalThis.navigator?.deviceMemory,
  onProgress = (_bytes, _phase) => {},
  send = wallRequest,
  sendObjectPart = uploadObjectPart,
  sendNativeFile = uploadNativeWallFile
}) {
  const root = `${baseUrl}/api/flamingo-wall/uploads`;
  const metadata = {
    text,
    title,
    name: file.name,
    type,
    size: file.size,
    duration,
    premium,
    priceTpg,
    ...(restorePostId ? { restorePostId } : {})
  };
  const session = await send(
    root,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'X-Upload-Id': uploadId
      },
      body: JSON.stringify(metadata)
    },
    { signal }
  );
  if (session.post) return { post: session.post };
  const chunkSize = Number(session.chunkBytes);
  if (!session.uploadId || !Number.isSafeInteger(chunkSize) || chunkSize < 1)
    throw new Error(
      'The upload server returned an invalid session. Please retry.'
    );
  // Keep only a few byte ranges in flight, independent of the video's size.
  // Unknown WebViews start conservatively; slow links and low-memory phones
  // retain the single-range path. S3 parts share the same 16 MiB budget.
  let concurrency = Math.min(
    connection ? 3 : 2,
    Math.max(1, Math.floor((16 * 1024 ** 2) / chunkSize))
  );
  if (
    connection?.saveData ||
    ['slow-2g', '2g', '3g'].includes(connection?.effectiveType) ||
    (deviceMemory > 0 && deviceMemory <= 2)
  )
    concurrency = 1;
  // Let existing requests finish, then retire extra workers for the rest of
  // this attempt. Do not cancel sibling requests or discard acknowledged bytes.
  const onRetry = () => {
    concurrency = 1;
  };
  const received = new Set((session.receivedOffsets || []).map(Number));
  const offsets = [];
  let uploaded = 0;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    if (received.has(offset))
      uploaded += Math.min(chunkSize, file.size - offset);
    else offsets.push(offset);
  }
  onProgress(uploaded, 'uploading');
  const supportsNative =
    session.nativeFileUpload === true &&
    session.transport !== 's3-multipart' &&
    (sendNativeFile !== uploadNativeWallFile ||
      typeof XMLHttpRequest === 'function');
  const workersController = new AbortController();
  const abort = () => workersController.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  let failure;
  try {
    if (!nativeFiles.has(file) || !supportsNative)
      await Promise.all(
        Array.from(
          { length: Math.min(concurrency, offsets.length) },
          async (_value, workerIndex) => {
            try {
              while (
                offsets.length &&
                workerIndex < concurrency &&
                !workersController.signal.aborted
              ) {
                const offset = offsets.shift();
                const chunk = await readUploadBytes(
                  file,
                  offset,
                  Math.min(offset + chunkSize, file.size),
                  workersController.signal
                );
                if (session.transport === 's3-multipart') {
                  const partNumber = offset / chunkSize + 1;
                  const partRoot = `${root}/${session.uploadId}/parts/${partNumber}`;
                  const ticket = await send(
                    `${partRoot}/sign`,
                    { method: 'POST', headers },
                    { signal: workersController.signal, onRetry }
                  );
                  const etag = await sendObjectPart(ticket.url, chunk, {
                    signal: workersController.signal,
                    onRetry
                  });
                  await send(
                    `${partRoot}/ack`,
                    {
                      method: 'POST',
                      headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ etag })
                    },
                    { signal: workersController.signal, onRetry }
                  );
                } else
                  await send(
                    `${root}/${session.uploadId}`,
                    {
                      method: 'PUT',
                      headers: {
                        ...headers,
                        'Content-Type': 'application/octet-stream',
                        'X-Upload-Offset': String(offset)
                      },
                      body: chunk
                    },
                    { signal: workersController.signal, onRetry }
                  );
                uploaded += chunk.byteLength;
                onProgress(uploaded, 'uploading');
              }
            } catch (error) {
              failure ||= error;
              workersController.abort();
            }
          }
        )
      );
    if (signal?.aborted) throw new DOMException('Upload paused.', 'AbortError');
    if (
      supportsNative &&
      (failure?.code === 'WALL_FILE_UNREADABLE' || nativeFiles.has(file)) &&
      uploaded < file.size
    ) {
      nativeFiles.add(file);
      onProgress(uploaded, 'native-uploading');
      // All range workers have stopped before the fallback starts. Reuse the
      // same session and original File; the server stages the body atomically.
      const receipt = await sendNativeFile({
        url: `${root}/${session.uploadId}/file`,
        headers,
        file,
        signal,
        onProgress: (bytes) => onProgress(bytes, 'native-uploading')
      });
      if (receipt.received !== file.size || receipt.complete !== true) {
        throw new Error(
          'The server did not confirm the full video. Resume to check your upload.'
        );
      }
      failure = undefined;
    }
    if (failure) throw failure;
    if (signal?.aborted) throw new DOMException('Upload paused.', 'AbortError');
    onProgress(file.size, 'publishing');
    return await send(
      `${root}/${session.uploadId}/complete`,
      { method: 'POST', headers },
      { signal, timeoutMs: 120_000 }
    );
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}
