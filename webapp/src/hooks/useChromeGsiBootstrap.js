import { useEffect } from 'react';
import { createAccount } from '../utils/api.js';

function isChromeBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Treat all Chromium-based desktop browsers as supported while avoiding Edge/Opera specific tokens
  const isChromium = /Chrome\/\d+/i.test(ua) || /CriOS\/\d+/i.test(ua);
  const isExcluded = /Edg\/|OPR\/|Brave\/|DuckDuckGo\//i.test(ua);
  return isChromium && !isExcluded;
}

function parseGoogleCredential(credential) {
  if (!credential || typeof credential !== 'string') return null;
  const parts = credential.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(parts[1]));
    return payload && typeof payload === 'object' ? payload : null;
  } catch (err) {
    console.error('Failed to parse Google credential', err);
    return null;
  }
}

async function ensureChromeAccount(googleId) {
  if (!googleId) return;
  try {
    const res = await createAccount(undefined, googleId);
    if (res?.accountId) {
      localStorage.setItem('accountId', res.accountId);
    }
    if (res?.walletAddress) {
      localStorage.setItem('walletAddress', res.walletAddress);
    }
  } catch (err) {
    console.error('Chrome account bootstrap failed', err);
  }
}

export default function useChromeGsiBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const telegramUser = window?.Telegram?.WebApp?.initDataUnsafe?.user;
    const isChrome = isChromeBrowser();
    if (!isChrome) return undefined;

    // Remove any residual blackout styling that may have been applied to deter Chrome usage
    document.body.style.backgroundColor = '';
    document.documentElement.style.backgroundColor = '';

    const existingGoogleId = localStorage.getItem('googleId');
    if (existingGoogleId) {
      ensureChromeAccount(existingGoogleId);
      return undefined;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || telegramUser) return undefined;

    let cancelled = false;

    const handleCredential = (response) => {
      if (cancelled || !response?.credential) return;
      const payload = parseGoogleCredential(response.credential);
      const googleId = payload?.sub;
      if (!googleId) return;

      localStorage.setItem('googleId', googleId);
      if (payload?.email) localStorage.setItem('googleEmail', payload.email);
      if (payload?.given_name) localStorage.setItem('googleFirstName', payload.given_name);
      if (payload?.family_name) localStorage.setItem('googleLastName', payload.family_name);
      ensureChromeAccount(googleId);
    };

    const initializeGoogle = () => {
      if (
        cancelled ||
        !window.google ||
        typeof window.google.accounts?.id?.initialize !== 'function'
      ) {
        return false;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        ux_mode: 'popup',
        auto_select: true,
        itp_support: true
      });
      window.google.accounts.id.prompt();
      return true;
    };

    if (!initializeGoogle()) {
      const interval = setInterval(() => {
        if (initializeGoogle()) {
          clearInterval(interval);
        }
      }, 400);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
      try {
        window.google?.accounts?.id?.cancel?.();
      } catch {}
    };
  }, []);
}
