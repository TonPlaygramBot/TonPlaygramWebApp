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
          existing.addEventListener('load', () => resolve(true));
          existing.addEventListener('error', () => resolve(false));
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
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
          theme: 'outline',
          shape: 'pill',
          size: 'large',
          text: 'continue_with'
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

  function handleClick() {
    if (window.google?.accounts?.id && initialized.current) {
      window.google.accounts.id.prompt();
    }
  }

  return (
    <div className="inline-flex items-center space-x-2">
      <div ref={buttonRef} />
      {!ready && (
        <button
          type="button"
          onClick={handleClick}
          disabled={!ready}
          className="px-3 py-1 bg-white text-black rounded disabled:opacity-50"
        >
          Link Google
        </button>
      )}
    </div>
  );
}
