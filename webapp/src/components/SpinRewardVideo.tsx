import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SOCIAL_CHANNELS } from '../config/socialChannels.js';
import { API_BASE_URL } from '../utils/api.js';

const REWARD_SECONDS = 15;
const INSTAGRAM_REELS_URL = `${SOCIAL_CHANNELS.find(({ id }) => id === 'instagram')?.url}/reels/`;

interface SpinRewardVideoProps {
  reelUrl: string | null;
  rewardOpen: boolean;
  onRewardComplete: () => void;
  onRewardClose: () => void;
}

interface InstagramPlayback {
  reelUrl: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}

export default function SpinRewardVideo({
  reelUrl,
  rewardOpen,
  onRewardComplete,
  onRewardClose,
}: SpinRewardVideoProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [remaining, setRemaining] = useState(REWARD_SECONDS);
  const [playback, setPlayback] = useState<InstagramPlayback | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const completeRef = useRef(onRewardComplete);
  const completedRef = useRef(false);
  const watchedRef = useRef(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const open = previewOpen || rewardOpen;
  const currentReelUrl = playback?.reelUrl || reelUrl;
  const mediaUrl = mediaFailed ? null : playback?.mediaUrl;
  const title = rewardOpen ? 'Instagram Reel · Spin reward' : 'Latest Instagram Reel';
  const close = () => {
    setPreviewOpen(false);
    if (rewardOpen) onRewardClose();
  };
  const closeRef = useRef(close);

  useLayoutEffect(() => {
    completeRef.current = onRewardComplete;
    closeRef.current = close;
  });

  useEffect(() => {
    watchedRef.current = 0;
    completedRef.current = false;
    setRemaining(REWARD_SECONDS);
  }, [rewardOpen]);

  useEffect(() => {
    setPlayback(null);
    setLoading(true);
    setMediaFailed(false);
    setNeedsPlay(false);
    if (!open) return;
    const controller = new AbortController();
    // Resolve on every opening/retry: Instagram CDN URLs expire.
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    let active = true;
    fetch(`${API_BASE_URL}/api/ads/spin-reel`, { signal: controller.signal, cache: 'no-store' })
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
  }, [open, rewardOpen, attempt]);

  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      if (videoRef.current === video) setNeedsPlay(true);
    });
  }, []);

  // Count visible, advancing playback, never time spent loading, paused, seeking,
  // buffering or in another app. Cap by wall time so speed/seek cannot skip the ad.
  useEffect(() => {
    const video = videoRef.current;
    if (!open || !rewardOpen || !video || loading || !mediaUrl) return;
    let playing = false;
    let lastTime = video.currentTime;
    let lastTick = performance.now();
    const reset = () => {
      lastTime = video.currentTime;
      lastTick = performance.now();
    };
    const start = () => { reset(); playing = true; };
    const stop = () => { reset(); playing = false; };
    const visibility = () => {
      reset();
      if (document.hidden) video.pause();
      else if (playing) playing = false;
    };
    const sample = () => {
      const now = performance.now();
      const wallSeconds = (now - lastTick) / 1000;
      let elapsed = video.currentTime - lastTime;
      // A short Reel can loop until the full 15 seconds have been watched.
      if (elapsed < 0 && video.loop && Number.isFinite(video.duration)) {
        elapsed += video.duration;
      }
      if (playing && !document.hidden && !video.paused && !video.seeking && video.readyState >= 3 && !completedRef.current) {
        watchedRef.current += Math.max(0, Math.min(elapsed, wallSeconds));
        const left = Math.max(0, Math.ceil(REWARD_SECONDS - watchedRef.current));
        setRemaining(left);
        if (watchedRef.current + 1e-6 >= REWARD_SECONDS) {
          setRemaining(0);
          completedRef.current = true;
          completeRef.current();
        }
      }
      lastTime = video.currentTime;
      lastTick = now;
    };
    const seeked = () => { reset(); playing = !video.paused; };
    video.addEventListener('playing', start);
    video.addEventListener('pause', stop);
    video.addEventListener('waiting', stop);
    video.addEventListener('seeking', stop);
    video.addEventListener('seeked', seeked);
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(sample, 100);
    return () => {
      window.clearInterval(timer);
      video.removeEventListener('playing', start);
      video.removeEventListener('pause', stop);
      video.removeEventListener('waiting', stop);
      video.removeEventListener('seeking', stop);
      video.removeEventListener('seeked', seeked);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [open, rewardOpen, loading, mediaUrl]);

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], video[controls], iframe');
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
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
            ref={dialogRef}
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
                {rewardOpen && remaining > 0 ? 'Cancel' : 'Close'}
              </button>
            </div>
            {rewardOpen && (
              <p role="status" className="pb-2 text-xs text-subtext">
                {remaining > 0 ? <>Watch <strong>{remaining}s</strong> to unlock your spin.</> : 'Spin unlocked! Skip or keep watching — your reward is kept.'}
              </p>
            )}
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
                onPause={() => setNeedsPlay(true)}
                onError={() => { setMediaFailed(true); setNeedsPlay(false); }}
                className="mx-auto aspect-[9/16] max-h-[60dvh] w-full shrink-0 rounded-lg bg-black object-contain"
              />
            ) : !rewardOpen && currentReelUrl ? (
              <iframe
                src={`${currentReelUrl}embed/`}
                title="TonPlaygram Instagram Reel"
                className="mx-auto aspect-[9/16] max-h-[60dvh] w-full shrink-0 rounded-lg border-0 bg-black"
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
            {!loading && !mediaUrl && (
              <div className="py-3 text-sm text-subtext">
                <p>{rewardOpen ? 'The reward video is unavailable. Retry to load the latest Reel. Your spin has not been used.' : 'Tap the Reel to play, or open Instagram.'}</p>
                <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 px-3 font-semibold text-brand-gold">Retry video</button>
              </div>
            )}
            {rewardOpen && (
              <button
                type="button"
                disabled={remaining > 0}
                onClick={close}
                className="mt-2 min-h-11 rounded-lg bg-primary px-3 text-sm font-semibold text-black disabled:opacity-50"
              >
                {remaining > 0 ? `Skip in ${remaining}s` : 'Skip video · keep reward'}
              </button>
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
