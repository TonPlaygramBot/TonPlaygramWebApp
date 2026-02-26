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

const isDocumentFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);

const collapseBrowserChrome = () => {
  requestAnimationFrame(() => {
    window.scrollTo(0, 1);
  });
};

const syncTelegramFullscreenClass = () => {
  const tg = window?.Telegram?.WebApp;
  const expanded = Boolean(tg?.isExpanded);
  const fullscreenActive = expanded || isDocumentFullscreen();
  document.body.classList.toggle('mobile-fullscreen', fullscreenActive);
  document.body.classList.toggle('mobile-browser-framed', !fullscreenActive);
};

const requestBrowserFullscreen = () => {
  const el = document.documentElement;
  const canRequest = el.requestFullscreen || el.webkitRequestFullscreen;

  if (!canRequest || isDocumentFullscreen()) {
    collapseBrowserChrome();
    return;
  }

  const run = () => {
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request) return;

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

  const onFirstInteraction = () => {
    run();
    window.removeEventListener('pointerdown', onFirstInteraction);
    window.removeEventListener('touchstart', onFirstInteraction);
  };

  window.addEventListener('pointerdown', onFirstInteraction, { passive: true, once: true });
  window.addEventListener('touchstart', onFirstInteraction, { passive: true, once: true });

  collapseBrowserChrome();

  return run;
};

export default function useTelegramFullscreen() {
  useEffect(() => {
    if (!isTelegramWebView()) return;

    const tg = window.Telegram?.WebApp;
    document.body.classList.add('telegram-fullscreen');

    tg?.ready?.();
    tg?.expand?.();
    tg?.disableVerticalSwipes?.();
    tg?.setHeaderColor?.('#0b0f1a');
    tg?.setBackgroundColor?.('#0b0f1a');

    setViewportVars();
    syncTelegramFullscreenClass();
    const requestFullscreen = requestBrowserFullscreen();

    const onResize = () => setViewportVars();
    const onModeChange = () => syncTelegramFullscreenClass();
    const onInteractionRetry = () => {
      if (isDocumentFullscreen()) return;
      requestFullscreen?.();
    };
    const onVisibility = () => {
      if (document.hidden || isDocumentFullscreen()) return;
      requestFullscreen?.();
    };

    const periodicRetry = window.setInterval(() => {
      if (document.hidden || isDocumentFullscreen()) return;
      requestFullscreen?.();
    }, RETRY_INTERVAL_MS);

    window.addEventListener('resize', onResize);
    window.addEventListener('fullscreenchange', onModeChange);
    window.addEventListener('webkitfullscreenchange', onModeChange);
    window.addEventListener('pointerdown', onInteractionRetry, { passive: true });
    window.addEventListener('touchstart', onInteractionRetry, { passive: true });
    window.addEventListener('keydown', onInteractionRetry);
    window.addEventListener('pageshow', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);

    const onViewportChanged = () => {
      setViewportVars();
      syncTelegramFullscreenClass();
    };
    tg?.onEvent?.('viewportChanged', onViewportChanged);

    return () => {
      window.clearInterval(periodicRetry);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('fullscreenchange', onModeChange);
      window.removeEventListener('webkitfullscreenchange', onModeChange);
      window.removeEventListener('pointerdown', onInteractionRetry);
      window.removeEventListener('touchstart', onInteractionRetry);
      window.removeEventListener('keydown', onInteractionRetry);
      window.removeEventListener('pageshow', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
      tg?.offEvent?.('viewportChanged', onViewportChanged);
      document.body.classList.remove('telegram-fullscreen');
      document.body.classList.remove('mobile-fullscreen');
      document.body.classList.remove('mobile-browser-framed');
    };
  }, []);
}
