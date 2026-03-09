import { useEffect, useMemo, useRef, useState } from 'react';

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
  const embedContainerRef = useRef(null);
  const videoId = useMemo(() => getVideoId(videoUrl), [videoUrl]);
  const canonicalVideoUrl = useMemo(() => {
    if (!videoId) return videoUrl || '';
    return `https://www.tiktok.com/@tonplaygram/video/${videoId}`;
  }, [videoId, videoUrl]);

  useEffect(() => {
    if (!autoOpen || !videoId || !storageKey) return;
    if (localStorage.getItem(storageKey) === '1') return;
    setOpen(true);
    localStorage.setItem(storageKey, '1');
  }, [autoOpen, storageKey, videoId]);

  useEffect(() => {
    if (!open || !videoId) return;
    if (!embedContainerRef.current) return;
    setShowFallback(false);
    const container = embedContainerRef.current;
    container.innerHTML = '';

    const blockquote = document.createElement('blockquote');
    blockquote.className = 'tiktok-embed';
    blockquote.setAttribute('cite', canonicalVideoUrl);
    blockquote.setAttribute('data-video-id', videoId);
    blockquote.style.maxWidth = '605px';
    blockquote.style.minWidth = '325px';
    blockquote.style.margin = '0 auto';
    blockquote.appendChild(document.createElement('section'));
    container.appendChild(blockquote);

    const existingScript = document.querySelector('script[src="https://www.tiktok.com/embed.js"]');
    if (existingScript && typeof window.tiktokEmbedLoad === 'function') {
      window.tiktokEmbedLoad();
    } else if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.tiktok.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    }

    const id = setTimeout(() => {
      const renderedFrame = container.querySelector('iframe');
      setShowFallback(!renderedFrame);
    }, 4500);
    return () => clearTimeout(id);
  }, [open, videoId, canonicalVideoUrl]);

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
              <div className="relative flex-1 min-h-0 overflow-auto p-3" ref={embedContainerRef}>
              </div>
            ) : (
              <div className="p-4 text-sm text-subtext">Invalid TikTok video URL.</div>
            )}
            {showFallback && (
              <div className="px-3 pt-2 text-center text-[11px] text-yellow-300 space-y-1">
                <p>Embedded preview can be blocked on some devices. Open it directly in TikTok.</p>
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
