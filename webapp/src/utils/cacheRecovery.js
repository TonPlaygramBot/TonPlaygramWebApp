const RECOVERY_FLAG = 'tonplaygram-cache-recovered';

async function clearTonplaygramCaches() {
  if (!('caches' in window)) return;
  try {
    const keys = await caches.keys();
    const targets = keys.filter((key) => key.includes('tonplaygram'));
    await Promise.all(targets.map((key) => caches.delete(key)));
  } catch (err) {
    console.warn('Cache cleanup skipped', err);
  }
}

async function refreshServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (reg) => {
        try {
          await reg.update();
        } catch {
          // noop
        }
      })
    );
  } catch {
    // ignore
  }
}

async function recoverFromChunkError() {
  if (sessionStorage.getItem(RECOVERY_FLAG)) return;
  sessionStorage.setItem(RECOVERY_FLAG, '1');
  await clearTonplaygramCaches();
  await refreshServiceWorkers();
  window.location.reload();
}

function isChunkLoadError(event) {
  if (!event) return false;
  if (event?.message?.includes?.('ChunkLoadError')) return true;
  if (event?.error?.name === 'ChunkLoadError') return true;
  if (typeof event?.reason === 'object' && event.reason?.name === 'ChunkLoadError') return true;
  if (typeof event?.reason === 'string' && event.reason.includes('ChunkLoadError')) return true;
  const target = event?.target;
  if (target?.tagName === 'SCRIPT' && target.src?.includes('/assets/')) return true;
  return false;
}

export function installChunkErrorRecovery() {
  window.addEventListener(
    'error',
    (event) => {
      if (isChunkLoadError(event)) {
        event.preventDefault?.();
        recoverFromChunkError();
      }
    },
    true
  );

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event)) {
      event.preventDefault?.();
      recoverFromChunkError();
    }
  });
}
