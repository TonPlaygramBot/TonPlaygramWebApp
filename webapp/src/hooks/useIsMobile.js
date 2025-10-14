import { useEffect, useState } from 'react';

export function useIsMobile(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const narrow = window.innerWidth <= maxWidth;
    return touch || narrow;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const check = () => {
      const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const narrow = window.innerWidth <= maxWidth;
      setIsMobile(touch || narrow);
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [maxWidth]);

  return isMobile;
}
