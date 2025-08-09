export async function fetchWithRetry(
  url, options = {},
  { retries = 3, baseBackoff = 500, maxBackoff = 8000,
    methods = ['GET','HEAD'],
    retryOn = (res) => res.status >= 500 && res.status <= 504,
    timeoutMs = 10000 } = {}
) {
  const method = (options.method || 'GET').toUpperCase();
  let attempt = 0, backoff = baseBackoff;

  while (true) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(to);
      if (!retryOn(res) || !methods.includes(method) || attempt >= retries) return res;

      const jitter = Math.floor(backoff * 0.2 * Math.random());
      await new Promise(r => setTimeout(r, backoff + jitter));
      attempt += 1;
      backoff = Math.min(backoff * 2, maxBackoff);
    } catch (err) {
      clearTimeout(to);
      if (attempt >= retries || !methods.includes(method)) throw err;
      const jitter = Math.floor(backoff * 0.2 * Math.random());
      await new Promise(r => setTimeout(r, backoff + jitter));
      attempt += 1;
      backoff = Math.min(backoff * 2, maxBackoff);
    }
  }
}
