import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function useTelegramBackButton() {
  const navigate = useNavigate();

  useEffect(() => {
    const tg = window?.Telegram?.WebApp;
    if (!tg) return;

    const handleBack = () => navigate(-1);

    tg.BackButton.show();
    tg.onEvent('backButtonClicked', handleBack);

    return () => {
      tg.offEvent('backButtonClicked', handleBack);
      tg.BackButton.hide();
    };
  }, [navigate]);
}
