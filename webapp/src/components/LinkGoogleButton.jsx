import React, { useEffect, useRef, useState } from 'react';
import { linkGoogleAccount } from '../utils/api.js';

export default function LinkGoogleButton({ telegramId, accountId, onLinked }) {
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
          existing.addEventListener('load', () => resolve(true), {
            once: true
          });
          existing.addEventListener('error', () => resolve(false), {
            once: true
          });
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
          accountId,
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

    function renderOfficialButton() {
      if (!window.google?.accounts?.id || !buttonRef.current) return;

      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        shape: 'pill',
        size: 'large',
        text: 'signin_with',
        logo_alignment: 'left',
        width: 280
      });
    }

    async function init() {
      if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        console.warn('Missing Google client id');
        return false;
      }

      const ok = await ensureGoogleScript();
      if (!ok || cancelled || !window.google?.accounts?.id) return false;

      if (!initialized.current) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCredential,
          ux_mode: 'popup',
          cancel_on_tap_outside: false
        });
        initialized.current = true;
      }

      renderOfficialButton();
      setReady(true);
      return true;
    }

    init();

    const onDemandInit = () => {
      if (!ready) init();
    };

    window.addEventListener('google-account-init', onDemandInit);

    return () => {
      cancelled = true;
      window.removeEventListener('google-account-init', onDemandInit);
    };
  }, [telegramId, accountId, onLinked]);

  function handleClick() {
    if (window.google?.accounts?.id && initialized.current) {
      window.google.accounts.id.prompt();
      return;
    }

    // Try to initialise on demand if the automatic load failed
    const event = new Event('google-account-init');
    window.dispatchEvent(event);
  }

  return (
    <div className="inline-flex items-center space-x-2" aria-live="polite">
      <div ref={buttonRef} />
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm"
        aria-label="Sign in with Google"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 18 18"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="#4285F4"
            d="M17.64 9.2045c0-.6385-.0573-1.2518-.1636-1.8409H9v3.4818h4.8441c-.2086 1.125-.8432 2.0796-1.7978 2.7195v2.2581h2.9086c1.7018-1.5668 2.6851-3.8741 2.6851-6.6185z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.4673-.8067 5.9568-2.1764l-2.9086-2.2581c-.8068.54-1.8377.8627-3.0482.8627-2.3455 0-4.3296-1.5832-5.0373-3.7104H.9577v2.3318C2.4382 15.9832 5.4818 18 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.9627 10.7178c-.1832-.54-.2877-1.1168-.2877-1.7178s.1045-1.1777.2877-1.7178V4.9505H.9577C.3477 6.161 0 7.5478 0 9s.3477 2.839 1.0145 4.0495l2.9482-2.3317z"
          />
          <path
            fill="#EA4335"
            d="M9 3.5795c1.3209 0 2.5073.4545 3.4395 1.3464l2.5791-2.5791C13.4645.891 11.4273 0 9 0 5.4818 0 2.4382 2.0168.9577 4.9505l3.005 2.3317C4.6704 5.1627 6.6545 3.5795 9 3.5795z"
          />
        </svg>
        {ready ? 'Sign in with Google' : 'Connect Google'}
      </button>
    </div>
  );
}
