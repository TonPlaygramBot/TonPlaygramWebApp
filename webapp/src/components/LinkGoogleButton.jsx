import React, { useCallback, useEffect, useRef, useState } from 'react';
import { linkGoogleAccount } from '../utils/api.js';

export default function LinkGoogleButton({ telegramId, onLinked }) {
  const buttonRef = useRef(null);
  const ensureScriptPromise = useRef(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('loading');
  const initialized = useRef(false);

  const ensureGoogleScript = useCallback(() => {
    if (window.google?.accounts?.id) return Promise.resolve(true);
    if (ensureScriptPromise.current) return ensureScriptPromise.current;

    ensureScriptPromise.current = new Promise((resolve) => {
      const existing = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      );
      if (existing) {
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    }).then((ok) => {
      if (!ok) ensureScriptPromise.current = null;
      return ok;
    });

    return ensureScriptPromise.current;
  }, []);

  const handleCredential = useCallback(
    (res) => {
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
    },
    [onLinked, telegramId]
  );

  const initGoogle = useCallback(
    async (isCancelled = () => false) => {
      if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        setReady(false);
        setStatus('error');
        return false;
      }

      if (initialized.current) {
        setReady(true);
        setStatus('ready');
        return true;
      }

      setStatus('loading');
      const ok = await ensureGoogleScript();
      if (!ok || isCancelled()) {
        setReady(false);
        setStatus('error');
        return false;
      }

      if (!window.google?.accounts?.id) {
        setReady(false);
        setStatus('error');
        return false;
      }

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredential,
        ux_mode: 'popup',
        cancel_on_tap_outside: false
      });

      if (buttonRef.current) {
        buttonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          shape: 'pill',
          size: 'large',
          text: 'signin_with',
          logo_alignment: 'center'
        });
      }

      initialized.current = true;
      setReady(true);
      setStatus('ready');
      return true;
    },
    [ensureGoogleScript, handleCredential]
  );

  useEffect(() => {
    let cancelled = false;

    initGoogle(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [initGoogle]);

  function handleClick() {
    if (status === 'error') {
      initialized.current = false;
      initGoogle();
      return;
    }

    if (window.google?.accounts?.id && initialized.current) {
      window.google.accounts.id.prompt();
    }
  }

  return (
    <div className="inline-flex flex-col space-y-2">
      <div ref={buttonRef} aria-live="polite" className="flex items-center" />
      {!ready && (
        <button
          type="button"
          onClick={handleClick}
          disabled={status === 'loading'}
          className="inline-flex items-center space-x-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
        >
          <img
            alt="Google"
            src="https://developers.google.com/identity/images/g-logo.png"
            className="h-5 w-5"
            aria-hidden="true"
          />
          <span>{status === 'loading' ? 'Loading Google...' : 'Sign in with Google'}</span>
        </button>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-500">Unable to load Google Sign-In right now. Tap the button to retry.</p>
      )}
    </div>
  );
}
