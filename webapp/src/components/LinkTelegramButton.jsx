import React, { useEffect, useRef } from 'react';
import { BOT_USERNAME } from '../utils/constants.js';

export default function LinkTelegramButton({ googleId, onLinked }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!googleId) return undefined;

    const callbackName = 'handleTelegramLinkAuth';

    window[callbackName] = (user) => {
      if (!user?.id) return;
      localStorage.setItem('telegramId', user.id);
      if (user.username) localStorage.setItem('telegramUsername', user.username);
      if (user.first_name) localStorage.setItem('telegramFirstName', user.first_name);
      if (user.last_name) localStorage.setItem('telegramLastName', user.last_name);
      if (user.photo_url) localStorage.setItem('telegramPhotoUrl', user.photo_url);
      if (onLinked) onLinked(user.id);
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.defer = true;
    script.dataset.telegramLogin = BOT_USERNAME;
    script.dataset.size = 'large';
    script.dataset.radius = '8';
    script.dataset.userpic = 'false';
    script.dataset.requestAccess = 'write';
    script.dataset.onauth = callbackName;

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
      delete window[callbackName];
    };
  }, [googleId, onLinked]);

  return (
    <div
      ref={containerRef}
      className="inline-flex items-center justify-start"
      aria-live="polite"
    />
  );
}
