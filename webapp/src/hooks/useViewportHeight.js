import { useEffect, useState } from 'react';

function readViewportHeight() {
  if (typeof window === 'undefined') {
    return 0;
  }
  const vv = window.visualViewport;
  if (vv && typeof vv.height === 'number') {
    return vv.height;
  }
  return window.innerHeight || 0;
}

export function useViewportHeight() {
  const [height, setHeight] = useState(() => readViewportHeight());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    let rafId = 0;
    const applyHeight = () => {
      rafId = 0;
      const next = readViewportHeight();
      setHeight((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
    };
    const queueHeight = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(applyHeight);
    };

    const viewport = window.visualViewport;

    queueHeight();
    window.addEventListener('resize', queueHeight);
    window.addEventListener('orientationchange', queueHeight);
    viewport?.addEventListener('resize', queueHeight);
    viewport?.addEventListener('scroll', queueHeight);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', queueHeight);
      window.removeEventListener('orientationchange', queueHeight);
      viewport?.removeEventListener('resize', queueHeight);
      viewport?.removeEventListener('scroll', queueHeight);
    };
  }, []);

  return height;
}

export default useViewportHeight;
