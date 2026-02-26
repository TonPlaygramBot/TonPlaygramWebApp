import { useEffect } from 'react';

import { isTelegramWebView } from '../utils/telegram.js';

const RETRY_INTERVAL_MS = 2000;

const setViewportVars = () => {
  const tg = window?.Telegram?.WebApp;
  const height = tg?.viewportHeight || window.innerHeight;
  const stableHeight = tg?.viewportStableHeight || height;
  document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`);
  document.documentElement.style.setProperty('--tg-viewport-stable-height', `${stableHeight}px`);
};

const collapseBrowserChrome = () => {
  requestAnimationFrame(() => {
    window.scrollTo(0, 1);
  });
};

const isDocumentFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);

const requestBrowserFullscreen = () => {
  const el = document.documentElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request || isDocumentFullscreen()) {
    collapseBrowserChrome();
    return;
  }

  try {
    Promise.resolve(request.call(el, { navigationUI: 'hide' }))
      .then(collapseBrowserChrome)
      .catch(collapseBrowserChrome);
  } catch {
    Promise.resolve(request.call(el))
      .then(collapseBrowserChrome)
      .catch(collapseBrowserChrome);
  }
};

export default function useTelegramFullscreen() {
  useEffect(() => {
    if (!isTelegramWebView()) return;

    const tg = window.Telegram?.WebApp;
    document.body.classList.add('telegram-fullscreen');

    const requestTelegramFullscreen = () => {
      tg?.expand?.();
      tg?.requestFullscreen?.();
      requestBrowserFullscreen();
      collapseBrowserChrome();
    };

    tg?.ready?.();
    tg?.disableVerticalSwipes?.();
    tg?.setHeaderColor?.('#0b0f1a');
    tg?.setBackgroundColor?.('#0b0f1a');

    setViewportVars();
    requestTelegramFullscreen();

    const onResize = () => {
      setViewportVars();
      requestTelegramFullscreen();
    };

    const onViewportChanged = () => {
      setViewportVars();
      requestTelegramFullscreen();
    };

    const onFullscreenRetry = () => {
      if (document.hidden) return;
      requestTelegramFullscreen();
    };

    const retryInterval = window.setInterval(() => {
      if (document.hidden) return;
      requestTelegramFullscreen();
    }, RETRY_INTERVAL_MS);

    window.addEventListener('resize', onResize);
    window.addEventListener('pointerdown', onFullscreenRetry, { passive: true });
    window.addEventListener('touchstart', onFullscreenRetry, { passive: true });
    window.addEventListener('keydown', onFullscreenRetry);
    window.addEventListener('pageshow', onFullscreenRetry);
    window.addEventListener('fullscreenchange', onFullscreenRetry);
    window.addEventListener('webkitfullscreenchange', onFullscreenRetry);
    document.addEventListener('visibilitychange', onFullscreenRetry);
    tg?.onEvent?.('viewportChanged', onViewportChanged);
    tg?.onEvent?.('fullscreenChanged', onFullscreenRetry);

    return () => {
      window.clearInterval(retryInterval);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', onFullscreenRetry);
      window.removeEventListener('touchstart', onFullscreenRetry);
      window.removeEventListener('keydown', onFullscreenRetry);
      window.removeEventListener('pageshow', onFullscreenRetry);
      window.removeEventListener('fullscreenchange', onFullscreenRetry);
      window.removeEventListener('webkitfullscreenchange', onFullscreenRetry);
      document.removeEventListener('visibilitychange', onFullscreenRetry);
      tg?.offEvent?.('viewportChanged', onViewportChanged);
      tg?.offEvent?.('fullscreenChanged', onFullscreenRetry);
      document.body.classList.remove('telegram-fullscreen');
    };
  }, []);
}
