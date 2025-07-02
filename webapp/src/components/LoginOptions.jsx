import React, { useEffect } from 'react';
import { RiTelegramFill } from 'react-icons/ri';
import { BOT_USERNAME } from '../utils/constants.js';

const TG_LINK = `https://t.me/${BOT_USERNAME}`;

export default function LoginOptions() {
  useEffect(() => {
    function handleCredential(res) {
      try {
        const data = JSON.parse(atob(res.credential.split('.')[1]));
        if (data.sub) localStorage.setItem('googleId', data.sub);
      } catch {}
    }

    function renderButton() {
      if (window.google && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCredential
        });
        window.google.accounts.id.renderButton(
          document.getElementById('g_id_button'),
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
  }, []);

  return (
    <div className="p-4 text-text">
      <p>Sign in with Google or open the WebApp in Telegram.</p>
      <div className="mt-2 flex items-center space-x-2">
        <div id="g_id_button"></div>
        <a
          href={TG_LINK}
          className="inline-flex items-center space-x-1 px-3 py-1 bg-primary hover:bg-primary-hover text-background rounded"
        >
          <RiTelegramFill className="w-4 h-4" />
          <span>Open in Telegram</span>
        </a>
      </div>
    </div>
  );
}
