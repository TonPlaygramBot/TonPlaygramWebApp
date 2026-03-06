import { useEffect, useMemo, useState } from 'react';

function getVideoId(urlOrId) {
  if (!urlOrId) return '';
  if (/^\d+$/.test(urlOrId)) return urlOrId;
  const raw = String(urlOrId);
  const match = raw.match(/\/video\/(\d+)/);
  if (match) return match[1];

  const shortLinkVideoMap = {
    'https://vt.tiktok.com/ZSu8hSaGs/': '7614140234548153607',
    'https://vt.tiktok.com/ZSu8hAvuM/': '7614138222150847762',
    'https://vt.tiktok.com/ZSu8hN8Xq/': '7614133483421584658',
    'https://vt.tiktok.com/ZSu8hc7YM/': '7614119495149292818',
  };
  return shortLinkVideoMap[raw] || '';
}

export default function TikTokTaskVideo({
  videoUrl,
  title = 'Watch Promo Video',
  autoOpen = false,
  storageKey,
}) {
  const [open, setOpen] = useState(false);
  const videoId = useMemo(() => getVideoId(videoUrl), [videoUrl]);
  const embedUrl = useMemo(() => {
    if (!videoId) return '';
    return `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&loop=1&music_info=0&description=0&controls=1`;
  }, [videoId]);

  useEffect(() => {
    if (!autoOpen || !embedUrl || !storageKey) return;
    if (localStorage.getItem(storageKey) === '1') return;
    setOpen(true);
    localStorage.setItem(storageKey, '1');
  }, [autoOpen, embedUrl, storageKey]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-brand-gold/60 bg-black/40 px-3 py-2 text-sm font-semibold text-brand-gold"
      >
        {title}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl overflow-hidden border border-white/20 bg-black">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/15">
              <span className="text-sm font-semibold text-white">{title}</span>
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-subtext hover:text-white"
              >
                Close
              </button>
            </div>
            {embedUrl ? (
              <div className="relative w-full pt-[177.78%]">
                <iframe
                  title={title}
                  src={embedUrl}
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <div className="p-4 text-sm text-subtext">Invalid TikTok video URL.</div>
            )}
            <a
              href={videoUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-xs text-subtext py-2"
            >
              Open on TikTok
            </a>
          </div>
        </div>
      )}
    </>
  );
}
