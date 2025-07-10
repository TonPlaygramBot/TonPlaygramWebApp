import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function useTelegramBackButton(onBack) {
  const navigate = useNavigate();
  const cbRef = useRef(onBack);

  // Keep the latest callback without re-registering the listener
  useEffect(() => {
    cbRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    const tg = window?.Telegram?.WebApp;
    if (!tg) return;

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
  }, [navigate]);
}
