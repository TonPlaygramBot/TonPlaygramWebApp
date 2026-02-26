import { useEffect } from 'react';

import { isTelegramWebView } from '../utils/telegram.js';

const setViewportVars = () => {
  const tg = window?.Telegram?.WebApp;
  const height = tg?.viewportHeight || window.innerHeight;
  const stableHeight = tg?.viewportStableHeight || height;
  document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`);
  document.documentElement.style.setProperty('--tg-viewport-stable-height', `${stableHeight}px`);
};

export default function useTelegramFullscreen() {
  useEffect(() => {
    if (!isTelegramWebView()) return;

    const tg = window.Telegram?.WebApp;
    document.body.classList.add('telegram-fullscreen');

    tg?.ready?.();
    tg?.expand?.();
    tg?.disableVerticalSwipes?.();
    tg?.setHeaderColor?.('#0b0f1a');
    tg?.setBackgroundColor?.('#0b0f1a');

    setViewportVars();

    const onResize = () => setViewportVars();
    window.addEventListener('resize', onResize);

    const onViewportChanged = () => setViewportVars();
    tg?.onEvent?.('viewportChanged', onViewportChanged);

    return () => {
      window.removeEventListener('resize', onResize);
      tg?.offEvent?.('viewportChanged', onViewportChanged);
      document.body.classList.remove('telegram-fullscreen');
    };
  }, []);
}
