import { useEffect } from 'react';

const ORIENTATION_FALLBACK_SEPARATOR = '-';

export default function useOrientationLock(target = 'portrait-primary') {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const orientation = window.screen?.orientation;
    if (!orientation || typeof orientation.lock !== 'function') {
      return undefined;
    }

    let isLocked = false;
    let cancelled = false;

    const tryLock = async (mode) => {
      if (!mode || cancelled) return false;
      try {
        await orientation.lock(mode);
        if (!cancelled) {
          isLocked = true;
          return true;
        }
      } catch (err) {
        console.warn('Orientation lock failed', err);
      }
      return false;
    };

    const lock = async () => {
      if (cancelled) return;
      isLocked = false;
      if (await tryLock(target)) return;
      if (target.includes(ORIENTATION_FALLBACK_SEPARATOR)) {
        const fallback = target.split(ORIENTATION_FALLBACK_SEPARATOR)[0];
        if (fallback && fallback !== target) {
          await tryLock(fallback);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (!orientation.unlock) return;
      if (document.visibilityState !== 'visible' && isLocked) {
        orientation.unlock();
        isLocked = false;
      } else if (document.visibilityState === 'visible' && !isLocked) {
        lock();
      }
    };

    lock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (orientation.unlock && isLocked) {
        orientation.unlock();
      }
    };
  }, [target]);
}
