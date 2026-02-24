import { useEffect } from 'react';

import { isTelegramWebView } from '../utils/telegram.js';

const MOBILE_BREAKPOINT_PX = 1024;

const isMobileScreen = () => {
  if (typeof window === 'undefined') return false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  return coarsePointer || window.innerWidth <= MOBILE_BREAKPOINT_PX;
};

const setViewportHeightVar = () => {
  const visualHeight = window.visualViewport?.height;
  const height = Math.round(visualHeight || window.innerHeight);
  document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
};

export default function useMobileFullscreen() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isTelegramWebView()) return;
    if (!isMobileScreen()) return;

    document.body.classList.add('mobile-fullscreen');
    setViewportHeightVar();

    const onResize = () => setViewportHeightVar();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      document.body.classList.remove('mobile-fullscreen');
    };
  }, []);
}
