import { useEffect, useMemo, useState } from 'react';

function getVideoId(urlOrId) {
  if (!urlOrId) return '';
  if (/^\d+$/.test(urlOrId)) return urlOrId;
  const raw = String(urlOrId).trim();
  const match = raw.match(/\/video\/(\d+)/);
  if (match) return match[1];

  const normalized = raw.endsWith('/') ? raw : `${raw}/`;

  const shortLinkVideoMap = {
    'https://vt.tiktok.com/ZSujamUuD/': '7614838290667031816',
    'https://vt.tiktok.com/ZSujaPuVF/': '7614600402654252296',
    'https://vt.tiktok.com/ZSujaXgpP/': '7614860616703986951',
    'https://vt.tiktok.com/ZSujagfxp/': '7614503027684216071',
  };
  return shortLinkVideoMap[raw] || shortLinkVideoMap[normalized] || '';
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
    return `https://www.tiktok.com/embed/v2/${videoId}`;
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
            <p className="px-3 pt-2 text-center text-[11px] text-subtext">
              If TikTok embed is unavailable on your device, use “Open on TikTok”.
            </p>
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
