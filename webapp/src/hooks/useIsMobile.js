import { useEffect, useState } from 'react';

export function useIsMobile(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return touch && window.innerWidth <= maxWidth;
  });

  useEffect(() => {
    const check = () => {
      const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(touch && window.innerWidth <= maxWidth);
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [maxWidth]);

  return isMobile;
}
