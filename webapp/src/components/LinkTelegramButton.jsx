import { useEffect, useRef, useState } from 'react';
import { linkTelegramAccount } from '../utils/api.js';

export default function LinkTelegramButton({ googleId, onLinked }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!googleId) return;

    window.handleTelegramLinkAuth = async (user) => {
      setError('');
      setLoading(true);
      try {
        const res = await linkTelegramAccount({ googleId, authData: user });
        if (res?.error) {
          setError(res.error);
        } else {
          if (user?.id) localStorage.setItem('telegramId', user.id);
          if (onLinked) onLinked(Number(user?.id));
        }
      } catch (err) {
        console.error('Failed to link Telegram', err);
        setError('Failed to link Telegram. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const container = containerRef.current;
    if (container) container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute(
      'data-telegram-login',
      import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'TonPlaygramBot'
    );
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'true');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'handleTelegramLinkAuth');

    if (container) container.appendChild(script);

    return () => {
      if (container) container.innerHTML = '';
      delete window.handleTelegramLinkAuth;
    };
  }, [googleId, onLinked]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} />
      {loading && <p className="text-sm text-subtext">Linking Telegram...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
