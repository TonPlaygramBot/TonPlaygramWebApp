import { useEffect } from 'react';
import { socket } from '../utils/socket.js';
import { ensureAccountId } from '../utils/telegram.js';
import { ensureAccountForUser, persistAccountLocally } from '../utils/account.js';

export default function useTelegramAuth() {
  useEffect(() => {
    const user = window?.Telegram?.WebApp?.initDataUnsafe?.user;
    const acc = localStorage.getItem('accountId');
    const googleId = localStorage.getItem('googleId');

    if (user?.id) {
      localStorage.setItem('telegramId', user.id);

      (async () => {
        try {
          const account = await ensureAccountForUser({ telegramId: user.id });
          persistAccountLocally({ ...account, telegramId: user.id });
          socket.emit('register', { playerId: account.accountId || user.id });
        } catch (err) {
          console.error('Failed to create account', err);
          socket.emit('register', { playerId: acc || user.id });
        }
      })();
    } else {
      (async () => {
        const accountId = acc || (await ensureAccountId());
        socket.emit('register', { playerId: accountId });
        try {
          const account = await ensureAccountForUser({ googleId });
          persistAccountLocally({ ...account, googleId });
        } catch (err) {
          console.error('Failed to create account', err);
        }
      })();
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
