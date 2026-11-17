import { useEffect, useState } from 'react';
import {
  getRejectedTelegramSession,
  TELEGRAM_SESSION_EVENT
} from '../utils/telegramSessionRecovery.js';

export default function TelegramSessionNotice() {
  const [rejectedSession, setRejectedSession] = useState(getRejectedTelegramSession);
  const [dismissedSession, setDismissedSession] = useState('');

  useEffect(() => {
    const refresh = () => setRejectedSession(getRejectedTelegramSession());
    window.addEventListener(TELEGRAM_SESSION_EVENT, refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    refresh(); // Catch a rejection that happened before this effect mounted.
    return () => {
      window.removeEventListener(TELEGRAM_SESSION_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  if (!rejectedSession || rejectedSession === dismissedSession) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed left-3 right-3 top-3 z-[10000] mx-auto max-w-md rounded-xl border border-amber-400 bg-gray-900 p-4 text-sm text-white shadow-lg"
    >
      <p className="font-semibold">Check your sign-in session</p>
      <p className="mt-1">
        TonPlayGram could not authenticate this request. If your Telegram session
        has expired, close this mini app when you are ready and open TonPlayGram again from the bot in
        Telegram. Reloading this page may reuse the same session. If you also
        signed in with Google, you may need to sign in with Google again.
      </p>
      <p className="mt-1">Check whether your last action completed before trying it again.</p>
      <button
        type="button"
        className="mt-3 min-h-11 rounded-lg border border-gray-500 px-4 py-2"
        onClick={() => setDismissedSession(rejectedSession)}
      >
        Dismiss for now
      </button>
    </aside>
  );
}
