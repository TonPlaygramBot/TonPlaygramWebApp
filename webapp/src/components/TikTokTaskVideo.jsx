import { useEffect, useMemo, useState } from 'react';

function getVideoId(urlOrId) {
  if (!urlOrId) return '';
  if (/^\d+$/.test(urlOrId)) return urlOrId;

  const raw = String(urlOrId).trim();
  const match = raw.match(/\/video\/(\d+)/);
  if (match) return match[1];

  const embedMatch = raw.match(/\/(?:embed\/(?:v2\/)?|player\/v1\/)(\d+)/);
  if (embedMatch) return embedMatch[1];

  const shortLinkVideoMap = {
    '/zsujamuuud': '7614838290667031816',
    '/zsujapuvf': '7614600402654252296',
    '/zsujaxgpp': '7614860616703986951',
    '/zsujagfxp': '7614503027684216071',
  };

  try {
    const parsedUrl = new URL(raw);
    const host = parsedUrl.hostname.toLowerCase();
    if (host === 'vt.tiktok.com' || host === 'www.vt.tiktok.com') {
      const pathKey = parsedUrl.pathname.toLowerCase().replace(/\/+$/, '');
      return shortLinkVideoMap[pathKey] || '';
    }
  } catch {
    // Ignore URL parsing errors and fallback to empty id.
  }

  return '';
}


export default function TikTokTaskVideo({
  videoUrl,
  title = 'Watch Promo Video',
  autoOpen = false,
  storageKey,
}) {
  const [open, setOpen] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const videoId = useMemo(() => getVideoId(videoUrl), [videoUrl]);
  const canonicalVideoUrl = useMemo(() => {
    if (!videoId) return videoUrl || '';
    return `https://www.tiktok.com/@tonplaygram/video/${videoId}`;
  }, [videoId, videoUrl]);
  const playerUrl = useMemo(() => {
    if (!videoId) return '';
    // Mobile browsers only permit reliable autoplay when embedded video starts muted.
    return `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&muted=1&loop=1&rel=0`;
  }, [videoId]);

  useEffect(() => {
    if (!autoOpen || !playerUrl || !storageKey) return;
    if (localStorage.getItem(storageKey) === '1') return;
    setOpen(true);
    localStorage.setItem(storageKey, '1');
  }, [autoOpen, playerUrl, storageKey]);

  useEffect(() => {
    if (!open || !playerUrl) return;
    setShowFallback(false);

    const id = window.setTimeout(() => {
      setShowFallback(true);
    }, 4500);

    return () => {
      clearTimeout(id);
    };
  }, [open, playerUrl]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-brand-gold/60 bg-black/40 px-3 py-2 text-sm font-semibold text-brand-gold"
      >
        {title}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-stretch justify-center">
          <div className="w-full h-full overflow-hidden border border-white/10 bg-black flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/15">
              <span className="text-sm font-semibold text-white">{title}</span>
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-subtext hover:text-white"
              >
                Close
              </button>
            </div>
            {canonicalVideoUrl ? (
              <div className="relative flex-1 min-h-0 p-1">
                <iframe
                  title={title}
                  src={playerUrl}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <div className="p-4 text-sm text-subtext">Invalid TikTok video URL.</div>
            )}
            {showFallback && (
              <div className="px-3 pt-2 text-center text-[11px] text-yellow-300">
                Video preview can be blocked in some devices. Use the direct TikTok link below.
              </div>
            )}
            <a
              href={canonicalVideoUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-sm font-semibold text-brand-gold py-3"
            >
              Open on TikTok
            </a>
          </div>
        </div>
      )}
    </>
  );
}
