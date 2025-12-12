import React, { useEffect, useRef, useState } from 'react';
import { linkGoogleAccount } from '../utils/api.js';

export default function LinkGoogleButton({ telegramId, onLinked }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const initialized = useRef(false);
  const buttonRef = useRef(null);

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
        }).then((resp) => {
          if (resp?.error) {
            setError(resp.error);
            return;
          }
          if (onLinked) onLinked();
        });
      } catch (err) {
        console.error('Failed to link Google account', err);
        setError('Unable to process Google response');
      }
    }

    function init() {
      if (
        initialized.current ||
        !window.google ||
        !import.meta.env.VITE_GOOGLE_CLIENT_ID ||
        !buttonRef.current
      ) {
        return false;
      }
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredential,
        ux_mode: 'popup'
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        shape: 'rectangular',
        theme: 'outline',
        text: 'continue_with',
        size: 'large',
        logo_alignment: 'left'
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

  return (
    <div className="space-y-2">
      <div ref={buttonRef} className="inline-block" aria-live="polite" />
      {!ready && (
        <button
          type="button"
          disabled
          className="px-3 py-1 bg-white text-black rounded opacity-60"
        >
          Loading Google...
        </button>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
