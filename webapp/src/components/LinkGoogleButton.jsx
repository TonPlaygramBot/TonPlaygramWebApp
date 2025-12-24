import React, { useEffect, useRef, useState } from 'react';
import { createAccount } from '../utils/api.js';
import { linkGoogleAccount } from '../utils/api.js';
import { decodeGoogleCredential, storeGoogleProfile } from '../utils/google.js';

export default function LinkGoogleButton({
  telegramId,
  onLinked,
  onAuthenticated,
  label = 'Link Google'
}) {
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    function handleCredential(res) {
      try {
        const profile = decodeGoogleCredential(res?.credential);
        if (!profile?.id) return;
        storeGoogleProfile(profile);
        if (telegramId) {
          linkGoogleAccount({
            telegramId,
            googleId: profile.id,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            photo: profile.photo
          }).then(() => {
            if (onLinked) onLinked();
            if (onAuthenticated) onAuthenticated(profile);
          });
        } else {
          // Standalone Chrome flow: create or attach account with Google profile
          createAccount(undefined, profile).finally(() => {
            if (onAuthenticated) onAuthenticated(profile);
          });
        }
      } catch (err) {
        console.error('Failed to link Google account', err);
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
        ux_mode: 'popup'
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
  }, [telegramId, onLinked, onAuthenticated]);

  function handleClick() {
    if (window.google && initialized.current) {
      window.google.accounts.id.prompt();
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
