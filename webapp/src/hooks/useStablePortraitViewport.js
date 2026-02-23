import { useEffect } from 'react';

const STABLE_HEIGHT_ATTR = 'data-app-stable-height';
const SETTLE_WINDOW_MS = 2200;

const readViewportHeight = () => {
  const tg = window?.Telegram?.WebApp;
  const tgHeight = Number(tg?.viewportHeight || 0);
  const visualHeight = Number(window.visualViewport?.height || 0);
  const innerHeight = Number(window.innerHeight || 0);
  return Math.round(Math.max(tgHeight, visualHeight, innerHeight, 0));
};

const readStableHeight = (root) => {
  const current = Number.parseFloat(root.style.getPropertyValue('--app-viewport-stable-height') || '0');
  return Number.isFinite(current) ? current : 0;
};

const setViewportHeightVars = ({ resetStable = false, allowGrowStable = false } = {}) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const viewportHeight = readViewportHeight();
  if (!viewportHeight) return;

  const root = document.documentElement;
  root.style.setProperty('--app-viewport-height', `${viewportHeight}px`);

  const hasStable = root.hasAttribute(STABLE_HEIGHT_ATTR);
  const stableHeight = readStableHeight(root);

  const shouldReset = resetStable || !hasStable;
  const shouldGrow = allowGrowStable && viewportHeight > stableHeight;
  if (shouldReset || shouldGrow) {
    root.style.setProperty('--app-viewport-stable-height', `${viewportHeight}px`);
    root.setAttribute(STABLE_HEIGHT_ATTR, '1');
  }
};

export default function useStablePortraitViewport() {
  useEffect(() => {
    let settleTimeout = 0;
    let shouldGrowStable = true;

    setViewportHeightVars({ resetStable: true, allowGrowStable: true });

    const onResize = () => setViewportHeightVars({ allowGrowStable: shouldGrowStable });
    const onOrientationChange = () => {
      // Let mobile browsers finish recalculating viewport after rotation.
      window.setTimeout(() => {
        shouldGrowStable = true;
        setViewportHeightVars({ resetStable: true, allowGrowStable: true });
      }, 120);
    };

    const tg = window?.Telegram?.WebApp;
    const onViewportChanged = () => setViewportHeightVars({ allowGrowStable: shouldGrowStable });

    settleTimeout = window.setTimeout(() => {
      shouldGrowStable = false;
      setViewportHeightVars({ allowGrowStable: false });
    }, SETTLE_WINDOW_MS);

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientationChange);
    window.visualViewport?.addEventListener?.('resize', onResize);
    tg?.onEvent?.('viewportChanged', onViewportChanged);

    return () => {
      window.clearTimeout(settleTimeout);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.visualViewport?.removeEventListener?.('resize', onResize);
      tg?.offEvent?.('viewportChanged', onViewportChanged);
    };
  }, []);
}
