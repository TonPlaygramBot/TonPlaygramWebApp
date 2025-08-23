import React, { useEffect } from 'react';
import { linkGoogleAccount } from '../utils/api.js';

export default function LinkGoogleButton({ telegramId, onLinked }) {
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

    function renderButton() {
      if (window.google && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCredential
        });
        window.google.accounts.id.renderButton(
          document.getElementById('link_google_button'),
          { theme: 'outline', size: 'large' }
        );
        return true;
      }
      return false;
    }

    if (!renderButton()) {
      const id = setInterval(() => {
        if (renderButton()) clearInterval(id);
      }, 500);
      return () => clearInterval(id);
    }
  }, [telegramId, onLinked]);

  return <div id="link_google_button"></div>;
}
