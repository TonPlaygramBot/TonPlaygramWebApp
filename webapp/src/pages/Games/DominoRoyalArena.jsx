import { useEffect, useMemo, useState } from 'react';

import { isTelegramWebView } from '../../utils/telegram.js';

export default function DominoRoyalArena({ search }) {
  const [src, setSrc] = useState(() => `/domino-royal.html${search || ''}`);
  const shouldUseStandalone = useMemo(() => {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const isCoarsePointer =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    return isTelegramWebView() || isMobileUA || isCoarsePointer;
  }, []);

  useEffect(() => {
    setSrc(`/domino-royal.html${search || ''}`);
  }, [search]);

  useEffect(() => {
    if (!shouldUseStandalone || typeof window === 'undefined') return;
    if (window.location.pathname === '/domino-royal.html') return;
    window.location.assign(src);
  }, [shouldUseStandalone, src]);

  if (shouldUseStandalone) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-sm text-white/70">
        Opening Domino Royal…
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black">
      <iframe
        key={src}
        src={src}
        title="Domino Royal 3D"
        className="absolute inset-0 h-full w-full border-0"
        allow="fullscreen; autoplay; clipboard-read; clipboard-write; accelerometer; gyroscope"
        allowFullScreen
      />
    </div>
  );
}
