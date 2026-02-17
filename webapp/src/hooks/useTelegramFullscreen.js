import { useEffect } from 'react';

import { isTelegramWebView } from '../utils/telegram.js';

const setViewportVars = () => {
  const tg = window?.Telegram?.WebApp;
  const height = tg?.viewportHeight || window.innerHeight;
  const stableHeight = tg?.viewportStableHeight || height;
  document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`);
  document.documentElement.style.setProperty('--tg-viewport-stable-height', `${stableHeight}px`);
};

const isGameRoute = (pathname) => {
  if (!pathname?.startsWith('/games/')) return false;
  if (pathname === '/games/transactions') return false;
  if (pathname.endsWith('/lobby')) return false;
  return true;
};

export default function useTelegramFullscreen() {
  useEffect(() => {
    if (!isTelegramWebView()) return;

    const tg = window.Telegram?.WebApp;
    document.body.classList.add('telegram-webview');

    tg?.ready?.();
    tg?.disableVerticalSwipes?.();
    tg?.setHeaderColor?.('#0b0f1a');
    tg?.setBackgroundColor?.('#0b0f1a');

    const syncFullscreenMode = () => {
      if (isGameRoute(window.location.pathname)) {
        tg?.expand?.();
        document.body.classList.add('telegram-game-fullscreen');
      } else {
        document.body.classList.remove('telegram-game-fullscreen');
      }
      setViewportVars();
    };

    const onResize = () => setViewportVars();
    window.addEventListener('resize', onResize);

    const onViewportChanged = () => setViewportVars();
    tg?.onEvent?.('viewportChanged', onViewportChanged);

    const notifyRouteChange = () => syncFullscreenMode();
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushStatePatched(...args) {
      const result = originalPushState.apply(this, args);
      notifyRouteChange();
      return result;
    };

    window.history.replaceState = function replaceStatePatched(...args) {
      const result = originalReplaceState.apply(this, args);
      notifyRouteChange();
      return result;
    };

    window.addEventListener('popstate', notifyRouteChange);

    syncFullscreenMode();

    return () => {
      window.removeEventListener('resize', onResize);
      tg?.offEvent?.('viewportChanged', onViewportChanged);
      window.removeEventListener('popstate', notifyRouteChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      document.body.classList.remove('telegram-webview', 'telegram-game-fullscreen');
    };
  }, []);
}
