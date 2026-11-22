import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SOCIAL_CHANNELS } from '../config/socialChannels.js';
import { API_BASE_URL } from '../utils/api.js';

const INSTAGRAM_REELS_URL = `${SOCIAL_CHANNELS.find(({ id }) => id === 'instagram')?.url}/reels/`;

interface SpinRewardVideoProps {
  reelUrl: string | null;
}

interface InstagramPlayback {
  reelUrl: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}

export default function SpinRewardVideo({
  reelUrl,
}: SpinRewardVideoProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [playback, setPlayback] = useState<InstagramPlayback | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [needsPlay, setNeedsPlay] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const open = previewOpen;
  const currentReelUrl = playback?.reelUrl || reelUrl;
  const mediaUrl = mediaFailed ? null : playback?.mediaUrl;
  const title = 'Latest Instagram Reel';
  const close = () => setPreviewOpen(false);

  useEffect(() => {
    setPlayback(null);
    setLoading(true);
    setMediaFailed(false);
    setNeedsPlay(false);
    if (!open) return;
    const controller = new AbortController();
    // Instagram's video URLs expire, so resolve the latest media on each opening.
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    let active = true;
    fetch(`${API_BASE_URL}/api/ads/spin-reel`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active) setPlayback(data); })
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open]);

  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      if (videoRef.current === video) setNeedsPlay(true);
    });
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!open || !video) return;
    video.muted = true;
    playVideo();
    return () => video.pause();
  }, [open, mediaUrl, loading, playVideo]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className="w-full rounded-lg border border-brand-gold/60 bg-black/40 px-3 py-2 text-sm font-semibold text-brand-gold"
      >
        Watch latest Instagram Reel
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-y-auto rounded-xl border border-border bg-surface p-3 text-center"
          >
            <div className="flex items-center justify-between gap-3 text-left">
              <h4 className="text-sm font-semibold text-white">{title}</h4>
              <button
                type="button"
                ref={closeButtonRef}
                onClick={close}
                className="min-h-11 px-2 text-sm text-white"
              >
                Close
              </button>
            </div>
            <p className="pb-2 text-xs text-subtext">
              Instagram playback is optional and does not unlock a reward.
            </p>
            {loading ? (
              <p role="status" className="py-8 text-sm text-subtext">Loading Instagram video…</p>
            ) : mediaUrl ? (
              <video
                key={mediaUrl}
                ref={videoRef}
                src={mediaUrl}
                poster={playback?.thumbnailUrl || undefined}
                aria-label="TonPlaygram Instagram Reel"
                autoPlay
                muted
                playsInline
                loop
                controls
                preload="auto"
                onPlaying={() => setNeedsPlay(false)}
                onError={() => { setMediaFailed(true); setNeedsPlay(false); }}
                className="mx-auto aspect-[9/16] max-h-[65dvh] w-full shrink-0 rounded-lg bg-black object-contain"
              />
            ) : currentReelUrl ? (
              <iframe
                src={`${currentReelUrl}embed/`}
                title="TonPlaygram Instagram Reel"
                className="mx-auto aspect-[9/16] max-h-[65dvh] w-full shrink-0 rounded-lg border-0 bg-black"
                allow="autoplay; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : null}
            {mediaUrl && needsPlay && (
              <button type="button" onClick={playVideo} className="min-h-11 rounded-lg bg-primary px-3 text-sm text-black">
                Play video
              </button>
            )}
            {!loading && !mediaUrl && currentReelUrl && (
              <p className="pt-2 text-xs text-subtext">Tap the Reel to play.</p>
            )}
            <a
              href={currentReelUrl || INSTAGRAM_REELS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-center text-sm font-semibold text-brand-gold"
            >
              {currentReelUrl ? 'Open Reel on Instagram' : 'Open @tonplaygram Reels on Instagram'}
            </a>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
