import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const resolveFallbackPath = (pathname) => {
  if (!pathname || pathname === '/') return '/';

  if (pathname.startsWith('/games/')) {
    const segments = pathname.split('/').filter(Boolean);
    const gameSlug = segments[1];

    if (segments.length >= 3 && segments[2] === 'lobby') return '/games';
    if (gameSlug) return `/games/${gameSlug}/lobby`;
    return '/games';
  }

  return '/';
};

const hasInAppBackHistory = () => {
  const idx = window?.history?.state?.idx;
  return typeof idx === 'number' ? idx > 0 : window.history.length > 1;
};

export default function useTelegramBackButton(onBackOrFallback) {
  const navigate = useNavigate();
  const location = useLocation();
  const cbRef = useRef(typeof onBackOrFallback === 'function' ? onBackOrFallback : null);
  const fallbackRef = useRef(
    typeof onBackOrFallback === 'string' && onBackOrFallback.trim()
      ? onBackOrFallback.trim()
      : null
  );

  // Keep the latest callback without re-registering the listener
  useEffect(() => {
    cbRef.current = typeof onBackOrFallback === 'function' ? onBackOrFallback : null;
    fallbackRef.current =
      typeof onBackOrFallback === 'string' && onBackOrFallback.trim()
        ? onBackOrFallback.trim()
        : null;
  }, [onBackOrFallback]);

  useEffect(() => {
    const tg = window?.Telegram?.WebApp;
    if (!tg) return;

    const fallbackPath = fallbackRef.current || resolveFallbackPath(location.pathname);
    const shouldShowBackButton = Boolean(cbRef.current) || location.pathname !== '/';

    if (!shouldShowBackButton) {
      tg.BackButton.hide();
      return;
    }

    const handleBack = () => {
      const cb = cbRef.current;
      if (cb) {
        cb();
        return;
      }

      if (hasInAppBackHistory()) {
        navigate(-1);
        return;
      }

      if (location.pathname !== fallbackPath) {
        navigate(fallbackPath, { replace: true });
      }
    };

    tg.BackButton.show();
    tg.onEvent('backButtonClicked', handleBack);

    return () => {
      tg.offEvent('backButtonClicked', handleBack);
      tg.BackButton.hide();
    };
  }, [navigate, location.pathname]);
}
