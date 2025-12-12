import React, { useEffect, useRef, useState } from 'react';
import { linkGoogleAccount } from '../utils/api.js';

export default function LinkGoogleButton({ telegramId, onLinked }) {
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
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
          if (onLinked) onLinked();
        });
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
  }, [telegramId, onLinked]);

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
      Link Google
    </button>
  );
}
