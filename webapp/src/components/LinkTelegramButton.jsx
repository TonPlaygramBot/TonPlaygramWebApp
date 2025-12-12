import React, { useEffect, useRef, useState } from 'react';
import { linkTelegramAccount } from '../utils/api.js';

function persistTelegramProfile(user) {
  if (!user) return;
  localStorage.setItem('telegramId', user.id);
  if (user.username) localStorage.setItem('telegramUsername', user.username);
  if (user.first_name) localStorage.setItem('telegramFirstName', user.first_name);
  if (user.last_name) localStorage.setItem('telegramLastName', user.last_name);
  if (user.photo_url) localStorage.setItem('telegramPhotoUrl', user.photo_url);
  localStorage.setItem('telegramUserData', JSON.stringify(user));
}

export default function LinkTelegramButton({ googleId, onLinked }) {
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef(null);
  const handlerName = useRef(`onTelegramAuth_${Math.random().toString(36).slice(2)}`);
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'TonPlaygramBot';

  useEffect(() => {
    if (!googleId || !containerRef.current) return undefined;

    window[handlerName.current] = async (user) => {
      if (!user?.id) return;
      setLinking(true);
      setError('');
      try {
        const res = await linkTelegramAccount({ authData: user, googleId });
        if (res?.error) {
          setError(res.error);
          return;
        }
        persistTelegramProfile(user);
        if (onLinked) onLinked(user);
      } catch (err) {
        console.error('Failed to link Telegram account', err);
        setError('Failed to link Telegram account');
      } finally {
        setLinking(false);
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.defer = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-onauth', `${handlerName.current}(user)`);
    script.setAttribute('data-request-access', 'write');
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(script);

    return () => {
      delete window[handlerName.current];
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [googleId, botUsername, onLinked]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} aria-live="polite" />
      {linking && <p className="text-sm text-subtext">Linking Telegram...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
