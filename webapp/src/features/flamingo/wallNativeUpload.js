// Keep the original picker File as a native multipart form entry. This path
// deliberately never calls slice(), arrayBuffer(), FileReader or new File().
// It is a compatibility fallback, not a way to bypass denied device access.
export function uploadNativeWallFile({
  url,
  headers,
  file,
  signal,
  onProgress = () => {},
  createRequest = () => new XMLHttpRequest(),
  idleTimeoutMs = 120_000
}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(new DOMException('Upload paused.', 'AbortError'));
    const request = createRequest();
    const form = new FormData();
    form.append('file', file);
    let timer;
    let settled = false;
    let transferred = 0;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      request.onload =
        request.onerror =
        request.onabort =
        request.ontimeout =
          null;
      request.upload.onprogress = null;
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const abort = () => {
      finish(reject, new DOMException('Upload paused.', 'AbortError'));
      request.abort();
    };
    const interrupted = () =>
      Object.assign(
        new Error(
          transferred
            ? 'Upload interrupted. Resume from Transfers to retry the file.'
            : 'The selected video could not be uploaded from this phone. Try again or choose it from Files.'
        ),
        {
          code: transferred
            ? 'WALL_NATIVE_INTERRUPTED'
            : 'WALL_FILE_UNREADABLE',
          retryable: false
        }
      );
    const touch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        finish(reject, interrupted());
        request.abort();
      }, idleTimeoutMs);
    };
    request.upload.onprogress = (event) => {
      if (settled) return;
      transferred = event.loaded;
      touch();
      // Multipart overhead is included in browser progress. Publication still
      // waits for the server's exact file-size receipt, not this estimate.
      if (event.lengthComputable && event.total > 0) {
        onProgress(
          Math.min(
            file.size,
            Math.floor((event.loaded / event.total) * file.size)
          )
        );
      }
    };
    request.onload = () => {
      let payload;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        return finish(
          reject,
          new Error(
            'The upload response was not confirmed. Resume to check the same upload.'
          )
        );
      }
      if (request.status >= 200 && request.status < 300)
        finish(resolve, payload);
      else
        finish(
          reject,
          Object.assign(
            new Error(
              payload.error || 'The video upload could not be completed.'
            ),
            {
              status: request.status,
              code: payload.code,
              retryable: false
            }
          )
        );
    };
    request.onerror = request.ontimeout = () => finish(reject, interrupted());
    request.onabort = () =>
      finish(
        reject,
        signal?.aborted
          ? new DOMException('Upload paused.', 'AbortError')
          : interrupted()
      );
    signal?.addEventListener('abort', abort, { once: true });
    try {
      request.open('POST', url, true);
      for (const [name, value] of Object.entries(headers || {})) {
        // The browser supplies the boundary matching the native FormData.
        if (name.toLowerCase() !== 'content-type')
          request.setRequestHeader(name, value);
      }
      touch();
      request.send(form);
    } catch (error) {
      finish(
        reject,
        ['NotReadableError', 'NotFoundError', 'SecurityError'].includes(
          error?.name
        )
          ? interrupted()
          : error
      );
    }
  });
}
