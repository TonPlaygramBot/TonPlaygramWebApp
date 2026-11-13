import React, { useEffect, useRef, useState } from 'react';
import { createAccount } from '../utils/api.js';
import { linkGoogleAccount } from '../utils/api.js';
import { decodeGoogleCredential, storeGoogleProfile } from '../utils/google.js';

export default function LinkGoogleButton({
  telegramId,
  onLinked,
  onAuthenticated,
  onError,
  label = 'Link Google'
}) {
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);

  const emitError = (message, details) => {
    if (onError) onError({ message, details });
  };

  useEffect(() => {

    async function handleCredential(res) {
      try {
        // Decoding is only for display. The API validates Google's signed token
        // before a profile is cached or the UI reports a successful sign-in.
        const credential = res?.credential;
        const profile = decodeGoogleCredential(credential);
        if (!profile?.id) throw new Error('Google did not return a valid sign-in credential.');
        let response;
        if (telegramId) {
          response = await linkGoogleAccount({ telegramId, googleCredential: credential });
          if (response?.error) throw new Error(response.error);
          response = await createAccount(telegramId);
        } else {
          response = await createAccount(undefined, profile, undefined, undefined, credential);
        }
        if (response?.error) throw new Error(response.error);
        if (!response?.accountId || !response?.sessionToken) {
          throw new Error('The server could not establish a verified account session.');
        }
        storeGoogleProfile(profile);
        if (telegramId && onLinked) onLinked();
        if (onAuthenticated) onAuthenticated(profile);
      } catch (err) {
        console.error('Failed to link Google account', err);
        emitError('Google login failed. Please try again.', err?.message || String(err));
      }
    }

    function init() {
      if (
        initialized.current ||
        !window.google ||
        !import.meta.env.VITE_GOOGLE_CLIENT_ID
      ) {
        return false;
      }
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredential,
        ux_mode: 'popup',
        error_callback: (error) => {
          const reason = error?.type || error?.message || 'unknown';
          emitError('Google authorization failed before login completed.', reason);
        }
      });
      initialized.current = true;
      setReady(true);
      return true;
    }

    if (!init()) {
      const id = setInterval(() => {
        if (init()) clearInterval(id);
      }, 500);
      return () => clearInterval(id);
    }
  }, [telegramId, onLinked, onAuthenticated, onError]);

  function handleClick() {
    if (window.google && initialized.current) {
      window.google.accounts.id.prompt((notification) => {
        const notDisplayed = notification?.isNotDisplayed?.();
        const skipped = notification?.isSkippedMoment?.();

        if (!notDisplayed && !skipped) return;

        const reason = notDisplayed
          ? notification?.getNotDisplayedReason?.()
          : notification?.getSkippedReason?.();

        if (reason === 'invalid_client') {
          emitError(
            'Google sign-in is not configured correctly for this app build.',
            'OAuth client not found. Ask support to verify VITE_GOOGLE_CLIENT_ID and authorized web origins in Google Cloud Console.'
          );
          return;
        }

        if (reason) {
          emitError('Google sign-in could not be started.', reason);
        }
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!ready}
      className="px-3 py-1 bg-white text-black rounded disabled:opacity-50"
    >
      {label}
    </button>
  );
}
