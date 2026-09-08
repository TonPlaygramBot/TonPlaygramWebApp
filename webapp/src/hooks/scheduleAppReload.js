import {
  hasWallTransfers,
  WALL_TRANSFER_ACTIVITY
} from '../features/flamingo/wallTransferActivity.js';

export function createAppReloadScheduler({ onReload, onUpdating }) {
  let pending = false;
  let disposed = false;
  let timer;
  const blocked = () => {
    if (hasWallTransfers()) return true;
    try {
      return localStorage.getItem('tonplaygram-game-active') === 'true';
    } catch {
      return false;
    }
  };
  const reconcile = () => {
    if (!pending || disposed) return;
    if (blocked()) {
      clearTimeout(timer);
      timer = undefined;
      onUpdating(false);
      return;
    }
    if (timer !== undefined) return;
    onUpdating(true);
    timer = setTimeout(() => {
      timer = undefined;
      // A file picker or upload can start during the update animation.
      if (blocked()) {
        onUpdating(false);
        return;
      }
      pending = false;
      try {
        localStorage.removeItem('tonplaygram-update-pending');
      } catch {}
      onReload();
    }, 750);
  };
  window.addEventListener(WALL_TRANSFER_ACTIVITY, reconcile);
  window.addEventListener('tonplaygram-game-ended', reconcile);
  return {
    request() {
      pending = true;
      try {
        localStorage.setItem('tonplaygram-update-pending', '1');
      } catch {}
      reconcile();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener(WALL_TRANSFER_ACTIVITY, reconcile);
      window.removeEventListener('tonplaygram-game-ended', reconcile);
    }
  };
}
