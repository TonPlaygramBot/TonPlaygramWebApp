import { useEffect, useRef, useState } from 'react';
import { socket } from '../utils/socket.js';
import { createAccount } from '../utils/api.js';
import { ensureAccountId, isTelegramWebView } from '../utils/telegram.js';
import { loadGoogleProfile } from '../utils/google.js';

export default function useTelegramAuth() {
  const [googleProfile, setGoogleProfile] = useState(() => loadGoogleProfile());
  const registeredTelegramId = useRef(null);

  useEffect(() => {
    const refresh = () => setGoogleProfile(loadGoogleProfile());
    window.addEventListener('googleProfileUpdated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('googleProfileUpdated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    let pollTimer;

    const registerTelegramUser = (user) => {
      if (!user?.id) return false;
      if (registeredTelegramId.current === user.id) return true;

      registeredTelegramId.current = user.id;
      localStorage.setItem('telegramId', user.id);
      if (user.username) localStorage.setItem('telegramUsername', user.username);
      if (user.first_name) localStorage.setItem('telegramFirstName', user.first_name);
      if (user.last_name) localStorage.setItem('telegramLastName', user.last_name);
      localStorage.setItem('telegramUserData', JSON.stringify(user));

      // Storage events do not fire in the window that made the change. Profile
      // pages mounted during a Telegram cold start need an explicit wake-up.
      window.dispatchEvent(new CustomEvent('telegramAuthUpdated', { detail: user }));
      // Register provisionally with the Telegram id, then replace it with the
      // authoritative account id returned by the current account endpoint.
      // A cached accountId can belong to an earlier guest/Google session.
      socket.emit('register', { tpcAccountNumber: user.id });
      createAccount(user.id)
        .then((account) => {
          if (account?.accountId) {
            localStorage.setItem('accountId', account.accountId);
            socket.emit('register', { tpcAccountNumber: account.accountId });
          }
          if (account?.walletAddress) {
            localStorage.setItem('walletAddress', account.walletAddress);
          }
        })
        .catch(err => {
          console.error('Failed to create account', err);
        });
      return true;
    };

    const tryTelegramAuth = () => {
      const webApp = window?.Telegram?.WebApp;
      webApp?.ready?.();
      return registerTelegramUser(webApp?.initDataUnsafe?.user);
    };

    if (tryTelegramAuth()) return undefined;

    // Telegram can inject its SDK and initData after React has mounted. Avoid
    // creating a guest account during that gap and retry while the WebView is
    // starting or returning from the background.
    if (isTelegramWebView()) {
      const startedAt = Date.now();
      const poll = () => {
        if (stopped || tryTelegramAuth()) return;
        if (Date.now() - startedAt < 10000) {
          pollTimer = window.setTimeout(poll, 100);
        }
      };
      pollTimer = window.setTimeout(poll, 100);
      window.addEventListener('focus', tryTelegramAuth);
      document.addEventListener('visibilitychange', tryTelegramAuth);

      return () => {
        stopped = true;
        window.clearTimeout(pollTimer);
        window.removeEventListener('focus', tryTelegramAuth);
        document.removeEventListener('visibilitychange', tryTelegramAuth);
      };
    }

    const acc = localStorage.getItem('accountId');
    (async () => {
      const accountId = acc || (await ensureAccountId());
      socket.emit('register', { tpcAccountNumber: accountId });
      try {
        const res = await createAccount(undefined, googleProfile);
        if (res?.accountId) localStorage.setItem('accountId', res.accountId);
        if (res?.walletAddress) localStorage.setItem('walletAddress', res.walletAddress);
      } catch (err) {
        console.error('Failed to create account', err);
      }
    })();
    return undefined;
  }, [googleProfile?.id]);
}
