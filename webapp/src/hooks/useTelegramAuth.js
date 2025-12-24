import { useEffect } from 'react';
import { socket } from '../utils/socket.js';
import { provisionAccount, getStoredAccount } from '../utils/account.js';
import { ensureAccountId } from '../utils/telegram.js';

export default function useTelegramAuth() {
  useEffect(() => {
    const user = window?.Telegram?.WebApp?.initDataUnsafe?.user;
    const acc = localStorage.getItem('accountId');
    const googleId = localStorage.getItem('googleId');
    const fallbackAccountId = acc || getStoredAccount().accountId;
    if (fallbackAccountId) {
      socket.emit('register', { playerId: fallbackAccountId });
    }
    if (user?.id) {
      localStorage.setItem('telegramId', user.id);
      (async () => {
        try {
          const { accountId } = await provisionAccount({ telegramId: user.id, googleId });
          if (accountId) {
            socket.emit('register', { playerId: accountId });
          }
        } catch (err) {
          console.error('Failed to create account', err);
        }
      })();
    } else {
      (async () => {
        const accountId = acc || (await ensureAccountId());
        socket.emit('register', { playerId: accountId });
        try {
          await provisionAccount({ googleId, telegramId: undefined });
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
