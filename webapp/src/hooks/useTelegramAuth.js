import { useEffect } from 'react';

export default function useTelegramAuth() {
  useEffect(() => {
    const user = window?.Telegram?.WebApp?.initDataUnsafe?.user;
    if (user?.id) {
      localStorage.setItem('telegramId', user.id);
      if (user.username) {
        localStorage.setItem('telegramUsername', user.username);
      }
    }
  }, []);
}
