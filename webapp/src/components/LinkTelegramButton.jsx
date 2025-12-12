import React, { useEffect, useRef } from 'react';
import { linkTelegramAccount } from '../utils/api.js';

const TELEGRAM_WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22';

export default function LinkTelegramButton({ googleId, accountId, onLinked }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!googleId && !accountId) return undefined;
    const handlerName = `onTelegramAuth_${Date.now()}`;

    window[handlerName] = async (user) => {
      try {
        localStorage.setItem('telegramId', user.id);
        if (user.username) localStorage.setItem('telegramUsername', user.username);
        if (user.first_name) localStorage.setItem('telegramFirstName', user.first_name);
        if (user.last_name) localStorage.setItem('telegramLastName', user.last_name);
        if (user.photo_url) localStorage.setItem('telegramPhotoUrl', user.photo_url);

        const res = await linkTelegramAccount({
          googleId,
          accountId,
          telegramData: user
        });

        if (res?.error) {
          console.error('Failed to link Telegram account', res.error);
          return;
        }

        if (onLinked) onLinked(user.id, res);
      } catch (err) {
        console.error('Telegram auth failed', err);
      }
    };

    const botName = import.meta.env.VITE_TELEGRAM_BOT || 'TonPlaygramBot';
    const script = document.createElement('script');
    script.src = TELEGRAM_WIDGET_SRC;
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', handlerName);

    const current = containerRef.current;
    if (current) {
      current.innerHTML = '';
      current.appendChild(script);
    }

    return () => {
      if (current) current.innerHTML = '';
      delete window[handlerName];
    };
  }, [googleId, accountId, onLinked]);

  return (
    <div className="flex flex-col gap-1">
      <div ref={containerRef} />
      <p className="text-xs text-subtext">
        Use the official Telegram login button to link your chat account.
      </p>
    </div>
  );
}
