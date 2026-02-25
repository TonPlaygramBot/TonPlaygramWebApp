import { useEffect } from 'react';

import { isTelegramWebView } from '../utils/telegram.js';

const MOBILE_BREAKPOINT_PX = 1024;
const FULLSCREEN_HEIGHT_RATIO = 0.92;

const isMobileScreen = () => {
  if (typeof window === 'undefined') return false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  return coarsePointer || window.innerWidth <= MOBILE_BREAKPOINT_PX;
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
};

const isBrowserFullscreenLike = () => {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  if (standalone || document.fullscreenElement) return true;

  const viewport = window.visualViewport;
  const viewportHeight = Math.round(viewport?.height || window.innerHeight);
  const screenHeight = Math.max(window.screen?.height || 0, window.screen?.availHeight || 0, window.innerHeight);
  if (!screenHeight) return false;
  return viewportHeight / screenHeight >= FULLSCREEN_HEIGHT_RATIO;
};

const syncMobileBrowserFrameClass = () => {
  const fullscreenLike = isBrowserFullscreenLike();
  document.body.classList.toggle('mobile-fullscreen', fullscreenLike);
  document.body.classList.toggle('mobile-browser-framed', !fullscreenLike);
};

const requestBrowserFullscreen = () => {
  const el = document.documentElement;
  const canRequest = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!canRequest || document.fullscreenElement) return;

  const run = () => {
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request) return;
    Promise.resolve(request.call(el)).catch(() => {});
  };

  const onFirstInteraction = () => {
    run();
    window.removeEventListener('pointerdown', onFirstInteraction);
    window.removeEventListener('touchstart', onFirstInteraction);
  };

  window.addEventListener('pointerdown', onFirstInteraction, { passive: true, once: true });
  window.addEventListener('touchstart', onFirstInteraction, { passive: true, once: true });
};

export default function useMobileFullscreen() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isTelegramWebView()) return;
    if (!isMobileScreen()) return;

    setDisplayModeClass();
    setViewportHeightVar();
    syncMobileBrowserFrameClass();
    requestBrowserFullscreen();

    const onResize = () => {
      setViewportHeightVar();
      syncMobileBrowserFrameClass();
    };
    const onModeChange = () => setDisplayModeClass();
    const onFullscreenChange = () => syncMobileBrowserFrameClass();
    const onVisibilityChange = () => {
      syncMobileBrowserFrameClass();
      if (!document.hidden) {
        requestBrowserFullscreen();
      }
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', onModeChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.matchMedia?.('(display-mode: standalone)').removeEventListener?.('change', onModeChange);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.body.classList.remove('mobile-fullscreen');
      document.body.classList.remove('mobile-browser-framed');
      document.body.classList.remove('mobile-standalone');
    };
  }, []);
}
