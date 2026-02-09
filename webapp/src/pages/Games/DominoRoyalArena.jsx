import { useEffect, useMemo, useState } from 'react';

import { isTelegramWebView } from '../../utils/telegram.js';

export default function DominoRoyalArena({ search }) {
  const isTelegram = useMemo(() => isTelegramWebView(), []);
  const [src, setSrc] = useState(() => (isTelegram ? '' : `/domino-royal.html${search || ''}`));

  useEffect(() => {
    const target = `/domino-royal.html${search || ''}`;
    if (isTelegram) {
      window.location.replace(target);
      return;
    }
    setSrc(target);
  }, [isTelegram, search]);

  return (
    <div className="relative w-full h-full bg-black">
      {isTelegram ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-lg font-semibold">Launching Domino Royal…</p>
          <p className="text-sm text-white/70">
            The domino arena opens in a full-page view for better stability in Telegram.
          </p>
        </div>
      ) : (
        <iframe
          key={src}
          src={src}
          title="Domino Royal 3D"
          className="absolute inset-0 h-full w-full border-0"
          allow="fullscreen; autoplay; clipboard-read; clipboard-write; accelerometer; gyroscope"
          allowFullScreen
        />
      )}
    </div>
  );
}
