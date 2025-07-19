import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function useTelegramBackButton(onBack) {
  const navigate = useNavigate();
  const location = useLocation();
  const cbRef = useRef(onBack);

  // Keep the latest callback without re-registering the listener
  useEffect(() => {
    cbRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    const tg = window?.Telegram?.WebApp;
    if (!tg) return;

    if (window.history.length <= 1 || location.pathname === '/') {
      tg.BackButton.hide();
      return;
    }

    const handleBack = () => {
      const cb = cbRef.current;
      if (cb) cb();
      else navigate(-1);
    };

    tg.BackButton.show();
    tg.onEvent('backButtonClicked', handleBack);

    return () => {
      tg.offEvent('backButtonClicked', handleBack);
      tg.BackButton.hide();
    };
  }, [navigate, location.pathname]);
}
