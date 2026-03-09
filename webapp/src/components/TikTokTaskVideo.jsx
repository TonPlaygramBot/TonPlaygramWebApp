import { useEffect, useMemo, useRef, useState } from 'react';

const TIKTOK_EMBED_SCRIPT_ID = 'tiktok-embed-script';

function ensureTikTokEmbedScript() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(TIKTOK_EMBED_SCRIPT_ID)) {
    if (window?.tiktokEmbed?.lib?.render) {
      window.tiktokEmbed.lib.render();
    }
    return;
  }

  const script = document.createElement('script');
  script.id = TIKTOK_EMBED_SCRIPT_ID;
  script.src = 'https://www.tiktok.com/embed.js';
  script.async = true;
  script.onload = () => {
    if (window?.tiktokEmbed?.lib?.render) {
      window.tiktokEmbed.lib.render();
    }
  };
  document.body.appendChild(script);
}

function getVideoId(urlOrId) {
  if (!urlOrId) return '';
  if (/^\d+$/.test(urlOrId)) return urlOrId;
  const raw = String(urlOrId).trim();
  const match = raw.match(/\/video\/(\d+)/);
  if (match) return match[1];

  const embedMatch = raw.match(/\/embed\/(?:v2\/)?(\d+)/);
  if (embedMatch) return embedMatch[1];

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
  const [showFallback, setShowFallback] = useState(false);
  const officialEmbedRef = useRef(null);
  const videoId = useMemo(() => getVideoId(videoUrl), [videoUrl]);
  const embedUrl = useMemo(() => {
    if (!videoId) return '';
    return `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&rel=0`;
  }, [videoId]);
  const legacyEmbedUrl = useMemo(() => {
    if (!videoId) return '';
    return `https://www.tiktok.com/embed/v2/${videoId}?autoplay=1&rel=0`;
  }, [videoId]);
  const canonicalVideoUrl = useMemo(() => {
    if (!videoId) return videoUrl || '';
    return `https://www.tiktok.com/@tonplaygram/video/${videoId}`;
  }, [videoId, videoUrl]);

  useEffect(() => {
    if (!autoOpen || !embedUrl || !storageKey) return;
    if (localStorage.getItem(storageKey) === '1') return;
    setOpen(true);
    localStorage.setItem(storageKey, '1');
  }, [autoOpen, embedUrl, storageKey]);

  useEffect(() => {
    if (!open || (!embedUrl && !videoId)) return;
    setShowFallback(false);
    const id = setTimeout(() => setShowFallback(true), 4000);
    return () => clearTimeout(id);
  }, [open, embedUrl, videoId]);

  useEffect(() => {
    if (!open || !videoId) return;
    ensureTikTokEmbedScript();
    if (window?.tiktokEmbed?.lib?.render && officialEmbedRef.current) {
      window.tiktokEmbed.lib.render(officialEmbedRef.current);
    }
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
            {videoId ? (
              <div className="relative flex-1 min-h-0 overflow-auto">
                <blockquote
                  ref={officialEmbedRef}
                  className="tiktok-embed"
                  cite={canonicalVideoUrl}
                  data-video-id={videoId}
                  style={{ maxWidth: 605, minWidth: 325, margin: '0 auto' }}
                >
                  <section />
                </blockquote>

                <iframe
                  title={`${title} fallback`}
                  src={embedUrl}
                  className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={() => setShowFallback(false)}
                />
              </div>
            ) : (
              <div className="p-4 text-sm text-subtext">Invalid TikTok video URL.</div>
            )}
            {showFallback && (
              <div className="px-3 pt-2 text-center text-[11px] text-yellow-300 space-y-1">
                <p>Video preview can be blocked in some devices. Open it directly in TikTok.</p>
                {legacyEmbedUrl && (
                  <a
                    href={legacyEmbedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block underline"
                  >
                    Try legacy TikTok embed
                  </a>
                )}
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
