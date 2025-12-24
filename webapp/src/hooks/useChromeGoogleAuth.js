import { useEffect, useRef } from 'react';
import { createAccount } from '../utils/api.js';
import { socket } from '../utils/socket.js';
import {
  isChromeBrowser,
  parseGoogleCredential,
  persistGoogleProfile,
  readStoredGoogleProfile
} from '../utils/google.js';
import { ensureAccountId } from '../utils/telegram.js';

export default function useChromeGoogleAuth() {
  const initialized = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const inTelegram = Boolean(window.Telegram?.WebApp);
    if (inTelegram) return undefined;

    if (!isChromeBrowser()) return undefined;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return undefined;

    let cancelled = false;
    let promptTimer = null;

    const registerAccount = async (profile) => {
      if (!profile?.googleId) return;
      try {
        const res = await createAccount(undefined, profile.googleId);
        if (res?.accountId) {
          localStorage.setItem('accountId', res.accountId);
          socket.emit('register', { playerId: res.accountId });
        } else {
          const fallbackId = await ensureAccountId();
          socket.emit('register', { playerId: fallbackId });
        }
        if (res?.walletAddress) {
          localStorage.setItem('walletAddress', res.walletAddress);
        }
      } catch (err) {
        console.error('Failed to create account with Google profile', err);
      }
    };

    const stored = readStoredGoogleProfile();
    if (stored.googleId) {
      registerAccount(stored);
    }

    const handleCredential = async (res) => {
      if (!res?.credential) return;
      const data = parseGoogleCredential(res.credential);
      if (!data?.sub) return;

      const profile = {
        googleId: data.sub,
        email: data.email,
        firstName: data.given_name,
        lastName: data.family_name,
        photo: data.picture
      };

      persistGoogleProfile(profile);
      await registerAccount(profile);
    };

    const initGoogle = () => {
      if (cancelled || initialized.current) return true;
      if (!window.google) return false;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        ux_mode: 'popup'
      });

      initialized.current = true;
      window.google.accounts.id.prompt();
      return true;
    };

    if (!initGoogle()) {
      promptTimer = setInterval(() => {
        if (initGoogle()) {
          clearInterval(promptTimer);
        }
      }, 500);
    }

    return () => {
      cancelled = true;
      if (promptTimer) clearInterval(promptTimer);
    };
  }, []);
}
