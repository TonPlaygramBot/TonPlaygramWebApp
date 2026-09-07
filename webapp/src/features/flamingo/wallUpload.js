// Upload state belongs to the selected file. Retrying uses the same session,
// skips acknowledged ranges, and never publishes the same file twice.
export async function wallRequest(
  url,
  init = {},
  {
    signal = undefined,
    attempts = 4,
    timeoutMs = 120_000,
    request = fetch,
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
            'Connection interrupted. Keep this page open and retry to resume your upload.'
          );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
    if (attempt + 1 < attempts) await delay(750 * 2 ** attempt);
  }
  throw failure;
}

export async function uploadWallFile({
  baseUrl,
  headers,
  file,
  uploadId,
  text,
  title,
  duration = 0,
  premium = false,
  priceTpg = 0,
  restorePostId = undefined,
  signal,
  onProgress = (_bytes, _phase) => {},
  send = wallRequest
}) {
  const root = `${baseUrl}/api/flamingo-wall/uploads`;
  const metadata = {
    text,
    title,
    name: file.name,
    type: file.type,
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
  const received = new Set((session.receivedOffsets || []).map(Number));
  const offsets = [];
  let uploaded = 0;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    if (received.has(offset))
      uploaded += Math.min(chunkSize, file.size - offset);
    else offsets.push(offset);
  }
  onProgress(uploaded, 'uploading');
  const workersController = new AbortController();
  const abort = () => workersController.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  let failure;
  try {
    // Send one range at a time. iOS/Android WebViews are prone to cancelling a
    // sibling fetch when two large request bodies compete on a weak uplink.
    // Small resumable ranges still make progress without restarting the video.
    await Promise.all(
      Array.from({ length: Math.min(1, offsets.length) }, async () => {
        try {
          while (offsets.length && !workersController.signal.aborted) {
            const offset = offsets.shift();
            const chunk = file.slice(
              offset,
              Math.min(offset + chunkSize, file.size)
            );
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
              { signal: workersController.signal }
            );
            uploaded += chunk.size;
            onProgress(uploaded, 'uploading');
          }
        } catch (error) {
          failure ||= error;
          workersController.abort();
        }
      })
    );
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
