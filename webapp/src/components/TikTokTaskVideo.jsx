import { useEffect, useMemo, useRef, useState } from 'react';

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

function ensureTikTokEmbedScript() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('script[data-tiktok-embed]')) return;
  const script = document.createElement('script');
  script.src = 'https://www.tiktok.com/embed.js';
  script.async = true;
  script.setAttribute('data-tiktok-embed', '1');
  document.body.appendChild(script);
}

export default function TikTokTaskVideo({
  videoUrl,
  title = 'Watch Promo Video',
  autoOpen = false,
  storageKey,
}) {
  const [open, setOpen] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);
  const videoId = useMemo(() => getVideoId(videoUrl), [videoUrl]);
  const canonicalVideoUrl = useMemo(() => {
    if (!videoId) return '';
    return `https://www.tiktok.com/@tonplaygram/video/${videoId}`;
  }, [videoId]);
  const embedRef = useRef(null);

  useEffect(() => {
    if (!autoOpen || !videoId || !storageKey) return;
    if (localStorage.getItem(storageKey) === '1') return;
    setOpen(true);
    localStorage.setItem(storageKey, '1');
  }, [autoOpen, videoId, storageKey]);

  useEffect(() => {
    if (!open || !videoId || !embedRef.current) return;
    setEmbedFailed(false);
    ensureTikTokEmbedScript();

    const timeout = setTimeout(() => {
      const rendered = embedRef.current?.querySelector('iframe');
      if (!rendered) setEmbedFailed(true);
    }, 3500);

    return () => clearTimeout(timeout);
  }, [open, videoId]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-brand-gold/60 bg-black/40 px-3 py-2 text-sm font-semibold text-brand-gold"
      >
        {title}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/15">
            <span className="text-sm font-semibold text-white">{title}</span>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-subtext hover:text-white"
            >
              Close
            </button>
          </div>

          {videoId ? (
            <div className="flex-1 overflow-auto p-2" ref={embedRef}>
              <blockquote
                className="tiktok-embed"
                cite={canonicalVideoUrl || videoUrl}
                data-video-id={videoId}
                style={{ margin: 0, minWidth: '100%', maxWidth: '100%' }}
              />
              {embedFailed && (
                <div className="p-4 text-sm text-subtext text-center">
                  TikTok video is unavailable in this in-app browser.
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-sm text-subtext">Invalid TikTok video URL.</div>
          )}

          <a
            href={canonicalVideoUrl || videoUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-center text-sm text-brand-gold py-3 border-t border-white/15"
          >
            Open on TikTok
          </a>
        </div>
      )}
    </>
  );
}
