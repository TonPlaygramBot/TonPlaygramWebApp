import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { socket } from '../utils/socket.js';
import { createAccount } from '../utils/api.js';
import { ensureAccountId } from '../utils/telegram.js';
import { loadGoogleProfile } from '../utils/google.js';

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
      if (Capacitor.isNativePlatform()) {
        void Preferences.set({ key: 'telegramId', value: String(user.id) });
        if (user.username) void Preferences.set({ key: 'telegramUsername', value: user.username });
        if (user.first_name) void Preferences.set({ key: 'telegramFirstName', value: user.first_name });
        if (user.last_name) void Preferences.set({ key: 'telegramLastName', value: user.last_name });
        const params = new URLSearchParams();
        params.set('user', JSON.stringify(user));
        void Preferences.set({ key: 'telegramInitData', value: params.toString() });
      }
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
