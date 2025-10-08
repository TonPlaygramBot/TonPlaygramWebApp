import { useEffect, useState } from 'react';
import { isTelegramWebView } from '../utils/telegram.js';

function computeIsMobile(maxWidth) {
  if (typeof window === 'undefined') return false;

  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touchCapable =
    'ontouchstart' in window ||
    (nav?.maxTouchPoints ?? 0) > 0 ||
    (nav?.msMaxTouchPoints ?? 0) > 0 ||
    coarsePointer ||
    isTelegramWebView();

  const widthOk = window.innerWidth <= maxWidth || isTelegramWebView();

  return touchCapable && widthOk;
}

export function useIsMobile(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(() => computeIsMobile(maxWidth));

  useEffect(() => {
    const check = () => {
      setIsMobile(computeIsMobile(maxWidth));
    };
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [maxWidth]);

  return isMobile;
}
