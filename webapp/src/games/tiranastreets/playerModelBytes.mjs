const MiB = 1024 * 1024;
const aborted = () => new DOMException('Character loading was cancelled.', 'AbortError');

/** Keep only compressed source bytes between the picker and gameplay. Every
 * renderer still parses its own skeleton, materials and GPU resources. */
export function createPlayerByteCache({maxBytes = 24 * MiB, maxEntries = 2, ttl = 120000, now = Date.now, fetcher = (...args) => fetch(...args)} = {}) {
  const ready = new Map(), pending = new Map();
  let retained = 0;
  const drop = key => {
    const item = ready.get(key);
    if (item) {retained -= item.bytes.byteLength; clearTimeout(item.timer); ready.delete(key);}
  };
  const remember = (key, bytes) => {
    if (bytes.byteLength > maxBytes || maxEntries < 1) return;
    drop(key);
    while (ready.size >= maxEntries || retained + bytes.byteLength > maxBytes) drop(ready.keys().next().value);
    const timer = setTimeout(() => drop(key), ttl); timer.unref?.();
    ready.set(key, {bytes, expires: now() + ttl, timer}); retained += bytes.byteLength;
  };
  async function download(url, signal) {
    const response = await fetcher(url, {signal});
    if (!response.ok) throw Error(`Character download failed (HTTP ${response.status}).`);
    const limit = 24 * MiB;
    if (Number(response.headers.get('content-length') || 0) > limit) {
      await response.body?.cancel();
      throw Error('Character exceeds the 24 MB mobile budget.');
    }
    let bytes;
    const reader = response.body?.getReader();
    if (reader) {
      const chunks = []; let length = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.byteLength;
          if (length > limit) {await reader.cancel(); throw Error('Character exceeds the 24 MB mobile budget.');}
          chunks.push(part.value);
        }
        const combined = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) {combined.set(chunk, offset); offset += chunk.byteLength;}
        bytes = combined.buffer;
      } finally {reader.releaseLock();}
    } else bytes = await response.arrayBuffer();
    if (signal.aborted) throw aborted();
    if (bytes.byteLength > limit || bytes.byteLength < 20) throw Error('Character file is unavailable or exceeds the mobile budget.');
    const header = new DataView(bytes);
    if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength)
      throw Error('Character file is not a complete GLB 2.0 model.');
    return bytes;
  }
  function load(url, {signal, reload = false} = {}) {
    if (signal?.aborted) return Promise.reject(aborted());
    const key = String(url);
    const cached = ready.get(key);
    if (reload || cached?.expires <= now()) drop(key);
    else if (cached) {
      ready.delete(key); ready.set(key, cached);
      return Promise.resolve(cached.bytes);
    }
    let request = pending.get(key);
    if (!request) {
      const controller = new AbortController();
      request = {controller, users: 0, settled: false, promise: undefined};
      const current = request;
      const timer = setTimeout(() => controller.abort(), 45000); timer.unref?.();
      request.promise = download(key, controller.signal).then(bytes => {
        if (!controller.signal.aborted) remember(key, bytes);
        return bytes;
      }).finally(() => {
        current.settled = true; clearTimeout(timer);
        if (pending.get(key) === current) pending.delete(key);
      });
      pending.set(key, request);
    }
    request.users++;
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (callback, value) => {
        if (finished) return;
        finished = true; signal?.removeEventListener('abort', cancel); request.users--;
        if (!request.settled && request.users === 0) {
          if (pending.get(key) === request) pending.delete(key);
          request.controller.abort();
        }
        callback(value);
      };
      const cancel = () => finish(reject, aborted());
      signal?.addEventListener('abort', cancel, {once: true});
      request.promise.then(bytes => finish(resolve, bytes), error => finish(reject, error));
      if (signal?.aborted) cancel();
    });
  }
  return {load, evict: drop, clear() {for (const key of ready.keys()) drop(key); for (const item of pending.values()) item.controller.abort(); pending.clear();}, get byteLength() {return retained;}, get size() {return ready.size;}};
}

export const playerModelBytes = createPlayerByteCache();
export function loadPlayerModelBytes(url, options) {
  const absolute = new URL(url, window.location.href);
  return playerModelBytes.load(absolute.href, options);
}

export function discardPlayerModelBytes(url) {
  playerModelBytes.evict(new URL(url, window.location.href).href);
}
