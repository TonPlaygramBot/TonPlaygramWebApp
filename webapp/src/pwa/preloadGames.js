const RUNTIME_CACHE_NAME = 'tonplaygram-runtime-v3';

const GAME_ENTRYPOINTS = [
  '/goal-rush.html',
  '/goal-rush-api.js',
  '/texas-holdem.html',
  '/texas-holdem.js',
  '/domino-royal.html',
  '/murlan-royale.html',
  '/roulette.html',
  '/chess-royale.html',
  '/pool-royale-api.js',
  '/power-slider.js',
  '/power-slider.css'
];

const runWhenIdle = cb => {
  if ('requestIdleCallback' in window) {
    return requestIdleCallback(cb, { timeout: 1500 });
  }
  return setTimeout(cb, 500);
};

export function warmGameCaches() {
  if (!('caches' in window) || !('serviceWorker' in navigator)) return;

  runWhenIdle(async () => {
    try {
      await navigator.serviceWorker.ready;
      const cache = await caches.open(RUNTIME_CACHE_NAME);
      await Promise.all(
        GAME_ENTRYPOINTS.map(async asset => {
          try {
            const request = new Request(asset, { cache: 'reload' });
            const response = await fetch(request);
            if (response.ok) {
              await cache.put(request, response.clone());
            }
          } catch (err) {
            console.warn('Skipping prefetch for', asset, err);
          }
        })
      );
    } catch (err) {
      console.warn('Skipping game warmup', err);
    }
  });
}

export { RUNTIME_CACHE_NAME };
