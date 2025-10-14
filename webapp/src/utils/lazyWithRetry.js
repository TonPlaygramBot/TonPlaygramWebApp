import { lazy } from 'react';

const CHUNK_ERROR_PATTERNS = [
  /Loading chunk [\d]+ failed/i,
  /ChunkLoadError/i,
  /CSS chunk load failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Cannot read properties of undefined \(reading 'call'\)/i
];

function isRecoverableChunkError(error) {
  if (!error) return false;
  const message = String(error?.message || error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function wait(delayMs) {
  return new Promise((resolve) => {
    const schedule = typeof setTimeout === 'function'
      ? setTimeout
      : (fn) => {
          fn();
          return 0;
        };
    schedule(resolve, delayMs);
  });
}

export function lazyWithRetry(factory, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = (attempt) => Math.min(2000 * attempt, 5000)
  } = options;

  return lazy(() => {
    let attempt = 0;

    const load = () =>
      factory().catch(async (error) => {
        const recoverable = isRecoverableChunkError(error);
        attempt += 1;
        const canRetry = attempt <= maxRetries && recoverable;
        if (canRetry) {
          const delay = typeof retryDelay === 'function'
            ? retryDelay(attempt, error)
            : retryDelay;
          if (delay > 0) {
            await wait(delay);
          }
          return load();
        }

        if (recoverable && typeof window !== 'undefined') {
          window.location.reload();
          return new Promise(() => {});
        }

        throw error;
      });

    return load();
  });
}

export default lazyWithRetry;
