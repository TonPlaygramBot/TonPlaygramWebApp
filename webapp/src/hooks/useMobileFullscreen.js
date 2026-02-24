import { useEffect } from 'react';

import { isTelegramWebView } from '../utils/telegram.js';

const MOBILE_BREAKPOINT_PX = 1024;

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

    document.body.classList.add('mobile-fullscreen');
    setDisplayModeClass();
    setViewportHeightVar();
    requestBrowserFullscreen();

    const onResize = () => setViewportHeightVar();
    const onModeChange = () => setDisplayModeClass();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', onModeChange);

    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.matchMedia?.('(display-mode: standalone)').removeEventListener?.('change', onModeChange);
      document.body.classList.remove('mobile-fullscreen');
      document.body.classList.remove('mobile-standalone');
    };
  }, []);
}
