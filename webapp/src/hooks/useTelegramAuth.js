import { useEffect } from 'react';
import { socket } from '../utils/socket.js';

export default function useTelegramAuth() {
  useEffect(() => {
    const user = window?.Telegram?.WebApp?.initDataUnsafe?.user;
    const acc = localStorage.getItem('accountId');
    if (user?.id) {
      localStorage.setItem('telegramId', user.id);
      socket.emit('register', { playerId: acc || user.id });
    } else if (acc) {
      socket.emit('register', { playerId: acc });
    }
    if (user?.username) {
      localStorage.setItem('telegramUsername', user.username);
    }
    if (user?.first_name) {
      localStorage.setItem('telegramFirstName', user.first_name);
    }
    if (user?.last_name) {
      localStorage.setItem('telegramLastName', user.last_name);
    }
    if (user) {
      localStorage.setItem('telegramUserData', JSON.stringify(user));
    }
  }, []);
}
