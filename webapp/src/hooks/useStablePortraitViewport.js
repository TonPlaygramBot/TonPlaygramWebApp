import { useEffect } from 'react';

const STABLE_HEIGHT_ATTR = 'data-app-stable-height';
const STABLE_HEIGHT_VALUE_ATTR = 'data-app-stable-height-value';

const readStableHeight = (root) => {
  const stableFromAttr = Number(root.getAttribute(STABLE_HEIGHT_VALUE_ATTR) || 0);
  if (Number.isFinite(stableFromAttr) && stableFromAttr > 0) return stableFromAttr;
  const stableFromStyle = Number.parseFloat(
    root.style.getPropertyValue('--app-viewport-stable-height') || '0'
  );
  return Number.isFinite(stableFromStyle) && stableFromStyle > 0 ? stableFromStyle : 0;
};

const setViewportHeightVars = ({ resetStable = false } = {}) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const tg = window.Telegram?.WebApp;
  const viewportHeight = Math.round(
    tg?.viewportHeight || window.visualViewport?.height || window.innerHeight || 0
  );
  const tgStableHeight = Math.round(tg?.viewportStableHeight || 0);
  if (!viewportHeight && !tgStableHeight) return;

  const currentHeight = Math.max(viewportHeight, tgStableHeight);
  const root = document.documentElement;
  root.style.setProperty('--app-viewport-height', `${currentHeight}px`);

  const previousStable = readStableHeight(root);
  const nextStable = resetStable
    ? currentHeight
    : Math.max(previousStable || 0, currentHeight);

  root.style.setProperty('--app-viewport-stable-height', `${nextStable}px`);
  root.setAttribute(STABLE_HEIGHT_ATTR, '1');
  root.setAttribute(STABLE_HEIGHT_VALUE_ATTR, String(nextStable));
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

    const tg = window.Telegram?.WebApp;
    tg?.onEvent?.('viewportChanged', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.visualViewport?.removeEventListener?.('resize', onResize);
      tg?.offEvent?.('viewportChanged', onResize);
    };
  }, []);
}
