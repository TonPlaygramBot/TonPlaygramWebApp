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
      // A missing user means Telegram has not injected initData yet. Report
      // that as "not ready" so cold-start WebViews continue through the poll
      // path below instead of returning from the effect as if auth succeeded.
      if (!user?.id) return false;
      if (registeredTelegramId.current === user.id) return true;

      registeredTelegramId.current = user.id;
      const acc = localStorage.getItem('accountId');
      localStorage.setItem('telegramId', user.id);
      if (user.username) localStorage.setItem('telegramUsername', user.username);
      if (user.first_name) localStorage.setItem('telegramFirstName', user.first_name);
      if (user.last_name) localStorage.setItem('telegramLastName', user.last_name);
      localStorage.setItem('telegramUserData', JSON.stringify(user));

      // localStorage's `storage` event is not fired in the same window. Notify
      // pages that mounted before Telegram finished injecting initData.
      window.dispatchEvent(new CustomEvent('telegramAuthUpdated', { detail: user }));
      socket.emit('register', { tpcAccountNumber: acc || user.id });
      createAccount(user.id).catch(err => {
        console.error('Failed to create account', err);
      });
      return true;
    };

    const readTelegramUser = () => {
      const webApp = window?.Telegram?.WebApp;
      webApp?.ready?.();
      return webApp?.initDataUnsafe?.user;
    };

    const tryTelegramAuth = () => registerTelegramUser(readTelegramUser());

    if (tryTelegramAuth()) return undefined;

    // Telegram's external SDK may finish after React mounts on a cold WebView.
    // Do not create a browser/guest identity while that Telegram user is still
    // arriving; retry briefly and wake immediately when the view is restored.
    if (isTelegramWebView()) {
      const startedAt = Date.now();
      const poll = () => {
        if (stopped || tryTelegramAuth()) return;
        if (Date.now() - startedAt < 10000) pollTimer = window.setTimeout(poll, 100);
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

    {
      const acc = localStorage.getItem('accountId');
      (async () => {
        const accountId = acc || (await ensureAccountId());
        socket.emit('register', { tpcAccountNumber: accountId });
        try {
          const res = await createAccount(undefined, googleProfile);
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
    return undefined;
  }, [googleProfile?.id]);
}
