import { useEffect } from 'react';
import { socket } from '../utils/socket.js';
import { createAccount } from '../utils/api.js';
import { ensureAccountId } from '../utils/telegram.js';

export default function useTelegramAuth() {
  useEffect(() => {
    const user = window?.Telegram?.WebApp?.initDataUnsafe?.user;
    const acc = localStorage.getItem('accountId');
    if (user?.id) {
      localStorage.setItem('telegramId', user.id);
      socket.emit('register', { playerId: acc || user.id });
      createAccount(user.id).catch(err => {
        console.error('Failed to create account', err);
      });
    } else {
      (async () => {
        const accountId = acc || (await ensureAccountId());
        socket.emit('register', { playerId: accountId });
        const googleId = localStorage.getItem('googleId');
        try {
          const res = await createAccount(undefined, googleId);
          if (res?.accountId) {
            localStorage.setItem('accountId', res.accountId);
          }
          if (res?.walletAddress) {
            localStorage.setItem('walletAddress', res.walletAddress);
          }
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
