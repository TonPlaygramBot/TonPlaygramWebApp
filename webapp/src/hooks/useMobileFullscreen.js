import { useEffect } from 'react';

import { isTelegramWebView } from '../utils/telegram.js';

const MOBILE_BREAKPOINT_PX = 1024;
const RETRY_INTERVAL_MS = 2000;

const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

const isMobileScreen = () => {
  if (typeof window === 'undefined') return false;

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  const narrowViewport = window.innerWidth <= MOBILE_BREAKPOINT_PX;
  const uaMobile = MOBILE_UA_REGEX.test(window.navigator.userAgent || '');
  const touchDevice = (window.navigator.maxTouchPoints || 0) > 0;

  return coarsePointer || narrowViewport || uaMobile || touchDevice;
};

const setViewportHeightVar = () => {
  const viewport = window.visualViewport;
  const height = Math.round(viewport?.height || window.innerHeight);
  const stableHeight = Math.round(window.innerHeight);
  const topOffset = Math.max(0, Math.round(viewport?.offsetTop || 0));
  document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
  document.documentElement.style.setProperty('--app-viewport-stable-height', `${stableHeight}px`);
  document.documentElement.style.setProperty('--app-viewport-offset-top', `${topOffset}px`);
};

const setDisplayModeClass = () => {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  document.body.classList.toggle('mobile-standalone', Boolean(standalone));
  return Boolean(standalone);
};

const isDocumentFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);

const canCollapseBrowserChrome = () => window.scrollY <= 2;

const collapseBrowserChrome = () => {
  // Best-effort fallback for mobile browsers that do not support Fullscreen API
  // (notably iOS browsers where fullscreen is limited).
  // Never force-scroll users back to the top after they have scrolled down.
  if (!canCollapseBrowserChrome()) return;

  requestAnimationFrame(() => {
    if (!canCollapseBrowserChrome()) return;
    window.scrollTo(0, 1);
  });
};

const syncMobileFullscreenClass = () => {
  const standalone = setDisplayModeClass();
  const fullscreenActive = standalone || isDocumentFullscreen();
  document.body.classList.toggle('mobile-fullscreen', fullscreenActive);
  document.body.classList.toggle('mobile-browser-framed', !fullscreenActive);
};

const requestBrowserFullscreen = () => {
  const el = document.documentElement;
  const canRequest = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!canRequest || document.fullscreenElement) {
    collapseBrowserChrome();
    return;
  }

  const run = () => {
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request) return;

    try {
      Promise.resolve(request.call(el, { navigationUI: 'hide' }))
        .then(() => {
          collapseBrowserChrome();
        })
        .catch(() => {
          collapseBrowserChrome();
        });
    } catch {
      Promise.resolve(request.call(el))
        .then(() => {
          collapseBrowserChrome();
        })
        .catch(() => {
          collapseBrowserChrome();
        });
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

export default function useMobileFullscreen() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isTelegramWebView()) return;
    if (!isMobileScreen()) return;

    syncMobileFullscreenClass();
    setViewportHeightVar();
    const requestFullscreen = requestBrowserFullscreen();

    const onInteractionRetry = () => {
      if (isDocumentFullscreen()) return;
      requestFullscreen?.();
    };

    const periodicRetry = window.setInterval(() => {
      if (document.hidden || isDocumentFullscreen()) return;
      requestFullscreen?.();
    }, RETRY_INTERVAL_MS);

    const onResize = () => setViewportHeightVar();
    const onModeChange = () => syncMobileFullscreenClass();
    const onVisibility = () => {
      if (document.hidden || isDocumentFullscreen()) return;
      requestFullscreen?.();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('fullscreenchange', onModeChange);
    window.addEventListener('webkitfullscreenchange', onModeChange);
    window.addEventListener('pointerdown', onInteractionRetry, { passive: true });
    window.addEventListener('touchstart', onInteractionRetry, { passive: true });
    window.addEventListener('keydown', onInteractionRetry);
    window.addEventListener('pageshow', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);
    window.visualViewport?.addEventListener('resize', onResize);
    window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', onModeChange);

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
      window.visualViewport?.removeEventListener('resize', onResize);
      window.matchMedia?.('(display-mode: standalone)').removeEventListener?.('change', onModeChange);
      document.body.classList.remove('mobile-fullscreen');
      document.body.classList.remove('mobile-browser-framed');
      document.body.classList.remove('mobile-standalone');
    };
  }, []);
}
