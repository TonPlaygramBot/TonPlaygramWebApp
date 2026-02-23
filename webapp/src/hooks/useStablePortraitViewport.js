import { useEffect } from 'react';

const STABLE_HEIGHT_ATTR = 'data-app-stable-height';

const setViewportHeightVars = ({ resetStable = false } = {}) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || 0);
  if (!viewportHeight) return;

  const root = document.documentElement;
  root.style.setProperty('--app-viewport-height', `${viewportHeight}px`);

  const shouldReset = resetStable || !root.hasAttribute(STABLE_HEIGHT_ATTR);
  if (shouldReset) {
    root.style.setProperty('--app-viewport-stable-height', `${viewportHeight}px`);
    root.setAttribute(STABLE_HEIGHT_ATTR, '1');
  }
};

export default function useStablePortraitViewport() {
  useEffect(() => {
    setViewportHeightVars({ resetStable: true });

    const onResize = () => setViewportHeightVars();
    const onOrientationChange = () => {
      // Let mobile browsers finish recalculating viewport after rotation.
      window.setTimeout(() => setViewportHeightVars({ resetStable: true }), 120);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientationChange);
    window.visualViewport?.addEventListener?.('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.visualViewport?.removeEventListener?.('resize', onResize);
    };
  }, []);
}

