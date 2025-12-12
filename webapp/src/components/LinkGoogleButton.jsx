import React, { useEffect, useRef, useState } from 'react';
import { linkGoogleAccount } from '../utils/api.js';

export default function LinkGoogleButton({ telegramId, onLinked }) {
  const [ready, setReady] = useState(false);
  const buttonRef = useRef(null);
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
          if (onLinked) onLinked(data.sub);
        });
      } catch (err) {
        console.error('Failed to link Google account', err);
      }
    }

    function injectScript() {
      const existing = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      );
      if (existing) return existing;
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      return script;
    }

    function renderButton() {
      if (!buttonRef.current) return;
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        type: 'standard'
      });
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
      renderButton();
      initialized.current = true;
      setReady(true);
      return true;
    }

    injectScript();

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
    <div className="space-y-1">
      <div ref={buttonRef} />
      <button
        type="button"
        onClick={handleClick}
        disabled={!ready}
        className="px-3 py-1 bg-white text-black rounded disabled:opacity-50"
      >
        Link Google
      </button>
    </div>
  );
}
