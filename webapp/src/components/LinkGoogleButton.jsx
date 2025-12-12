import React, { useEffect, useRef, useState } from 'react';
import { linkGoogleAccount } from '../utils/api.js';

export default function LinkGoogleButton({ telegramId, onLinked }) {
  const buttonRef = useRef(null);
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    let cancelled = false;

    function ensureGoogleScript() {
      return new Promise((resolve) => {
        if (window.google?.accounts?.id) return resolve(true);

        const existing = document.querySelector(
          'script[src="https://accounts.google.com/gsi/client"]'
        );
        if (existing) {
          if (
            existing.dataset.loaded === 'true' ||
            existing.readyState === 'complete' ||
            existing.readyState === 'loaded'
          ) {
            return resolve(true);
          }
          existing.addEventListener('load', () => resolve(true));
          existing.addEventListener('error', () => resolve(false));
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          script.dataset.loaded = 'true';
          resolve(true);
        };
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });
    }

    function handleCredential(res) {
      try {
        const data = JSON.parse(atob(res.credential.split('.')[1]));
        if (!data.sub) return;
        localStorage.setItem('googleId', data.sub);
        linkGoogleAccount({
          telegramId,
          googleId: data.sub,
          email: data.email,
          firstName: data.given_name,
          lastName: data.family_name,
          photo: data.picture
        }).then(() => {
          if (onLinked) onLinked(data.sub);
        });
      } catch (err) {
        console.error('Failed to link Google account', err);
      }
    }

    async function init() {
      if (
        initialized.current ||
        !import.meta.env.VITE_GOOGLE_CLIENT_ID
      ) {
        return false;
      }

      const ok = await ensureGoogleScript();
      if (!ok || cancelled || !window.google?.accounts?.id) return false;

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredential,
        ux_mode: 'popup',
        cancel_on_tap_outside: false
      });
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          shape: 'pill',
          size: 'large',
          text: 'signin_with',
          logo_alignment: 'left'
        });
      }
      initialized.current = true;
      setReady(true);
      return true;
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [telegramId, onLinked]);

  return (
    <div className="relative inline-flex items-center">
      <div
        ref={buttonRef}
        className={ready ? '' : 'pointer-events-none opacity-0'}
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center px-4 py-2 text-sm text-gray-700 bg-white border rounded-full">
          Loading Google Sign-In…
        </div>
      )}
    </div>
  );
}
