import { useEffect, useState } from 'react';
import { socket } from '../utils/socket.js';
import { createAccount } from '../utils/api.js';
import { ensureAccountId } from '../utils/telegram.js';
import { loadGoogleProfile } from '../utils/google.js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const PREF_KEYS = {
  id: 'telegramId',
  username: 'telegramUsername',
  first: 'telegramFirstName',
  last: 'telegramLastName',
  userData: 'telegramUserData'
};

async function persistNativeUser(user) {
  if (!user?.id || !Capacitor?.isNativePlatform?.()) return;
  try {
    await Promise.all([
      Preferences.set({ key: PREF_KEYS.id, value: String(user.id) }),
      user.username ? Preferences.set({ key: PREF_KEYS.username, value: user.username }) : Promise.resolve(),
      user.first_name ? Preferences.set({ key: PREF_KEYS.first, value: user.first_name }) : Promise.resolve(),
      user.last_name ? Preferences.set({ key: PREF_KEYS.last, value: user.last_name }) : Promise.resolve(),
      Preferences.set({ key: PREF_KEYS.userData, value: JSON.stringify(user) })
    ]);
  } catch {
    // ignore native persistence errors
  }
}

export default function useTelegramAuth() {
  const [googleProfile, setGoogleProfile] = useState(() => loadGoogleProfile());

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
    const user = window?.Telegram?.WebApp?.initDataUnsafe?.user;
    const acc = localStorage.getItem('accountId');
    if (user?.id) {
      localStorage.setItem('telegramId', user.id);
      void persistNativeUser(user);
      socket.emit('register', { playerId: acc || user.id });
      createAccount(user.id).catch(err => {
        console.error('Failed to create account', err);
      });
    } else {
      (async () => {
        const accountId = acc || (await ensureAccountId());
        socket.emit('register', { playerId: accountId });
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
  }, [googleProfile?.id]);
}
