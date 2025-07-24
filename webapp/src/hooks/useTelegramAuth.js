import { useEffect } from 'react';
import { socket } from '../utils/socket.js';
import { ensureAccountId } from '../utils/telegram.js';

export default function useTelegramAuth() {
  useEffect(() => {
    let accountId;
    const user = window?.Telegram?.WebApp?.initDataUnsafe?.user;
    ensureAccountId()
      .then((acc) => {
        accountId = acc;
        if (acc) {
          socket.emit('register', { accountId: acc });
        }
      })
      .catch(() => {});

    const onConnect = () => {
      if (accountId) socket.emit('register', { accountId });
    };
    socket.on('connect', onConnect);

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

    return () => {
      socket.off('connect', onConnect);
    };
  }, []);
}
