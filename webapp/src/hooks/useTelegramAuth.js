import { useEffect } from 'react';
import { socket } from '../utils/socket.js';
import { createAccount } from '../utils/api.js';
import { ensureAccountId } from '../utils/telegram.js';

export default function useTelegramAuth() {
  useEffect(() => {
    const user = window?.Telegram?.WebApp?.initDataUnsafe?.user;
    const acc = localStorage.getItem('accountId');
    const register = (id) => {
      if (!id) return;
      socket.emit('register', { playerId: id, accountId: id });
    };
    if (user?.id) {
      localStorage.setItem('telegramId', user.id);
      register(acc || user.id);
      createAccount(user.id).catch(err => {
        console.error('Failed to create account', err);
      });
    } else {
      (async () => {
        const accountId = acc || (await ensureAccountId());
        register(accountId);
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
    const onConnect = () => {
      const storedId = localStorage.getItem('accountId') || user?.id;
      register(storedId);
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
    return () => socket.off('connect', onConnect);
  }, []);
}
