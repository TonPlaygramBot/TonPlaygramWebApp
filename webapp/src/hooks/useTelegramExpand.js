import { useEffect } from 'react';

export default function useTelegramExpand() {
  useEffect(() => {
    const tg = window?.Telegram?.WebApp;
    if (tg && typeof tg.expand === 'function') {
      try {
        tg.expand();
      } catch (e) {
        // ignore errors, expansion is optional
      }
    }
  }, []);
}
