import React, { useEffect, useRef, useState } from 'react';
import { linkGoogleAccount } from '../utils/api.js';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export default function LinkGoogleButton({ telegramId, onLinked }) {
  const [ready, setReady] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const initialized = useRef(false);
  const buttonRef = useRef(null);

  useEffect(() => {
    let cleanup;
    if (window.google) {
      setScriptLoaded(true);
      return undefined;
    }

    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    const script = existing || document.createElement('script');

    const handleLoad = () => setScriptLoaded(true);
    script.addEventListener('load', handleLoad);

    if (!existing) {
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    cleanup = () => {
      script.removeEventListener('load', handleLoad);
    };

    return cleanup;
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !import.meta.env.VITE_GOOGLE_CLIENT_ID || !window.google) {
      return undefined;
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
        }).then((resp) => {
          if (resp?.error) {
            console.error('Failed to link Google account', resp.error);
          }
          if (onLinked) onLinked(data.sub);
        });
      } catch (err) {
        console.error('Failed to link Google account', err);
      }
    }

    if (!initialized.current) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredential,
        ux_mode: 'popup'
      });
      initialized.current = true;
    }

    if (buttonRef.current) {
      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with'
      });
      setReady(true);
    }

    return () => {
      if (buttonRef.current) {
        buttonRef.current.innerHTML = '';
      }
    };
  }, [scriptLoaded, telegramId, onLinked]);

  return (
    <div className="flex flex-col gap-2">
      <div ref={buttonRef} className="inline-flex" />
      {!ready && (
        <p className="text-xs text-subtext">Loading Google sign-in…</p>
      )}
    </div>
  );
}
