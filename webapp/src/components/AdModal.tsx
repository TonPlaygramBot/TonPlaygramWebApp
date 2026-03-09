import { useEffect, useMemo, useRef, useState } from 'react';

const AD_VIDEOS = [
  {
    iframeUrl: 'https://www.tiktok.com/embed/v2/7614860616703986951',
    fallbackUrl: 'https://vt.tiktok.com/ZSujaXgpP/',
  },
  {
    iframeUrl: 'https://www.tiktok.com/embed/v2/7614600402654252296',
    fallbackUrl: 'https://vt.tiktok.com/ZSujaPuVF/',
  },
  {
    iframeUrl: 'https://www.tiktok.com/embed/v2/7614503027684216071',
    fallbackUrl: 'https://vt.tiktok.com/ZSujagfxp/',
  },
];
const REWARD_DELAY_MS = 15_000;

interface AdModalProps {
  open: boolean;
  onComplete: () => void;
  onClose?: () => void;
}

export default function AdModal({ open, onComplete, onClose }: AdModalProps) {
  const rewardIssuedRef = useRef(false);
  const [remainingMs, setRemainingMs] = useState(REWARD_DELAY_MS);
  const [videoIndex, setVideoIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      rewardIssuedRef.current = false;
      setRemainingMs(REWARD_DELAY_MS);
      return;
    }

    setVideoIndex(Math.floor(Math.random() * AD_VIDEOS.length));

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(REWARD_DELAY_MS - elapsed, 0);
      setRemainingMs(remaining);
      if (remaining === 0 && !rewardIssuedRef.current) {
        rewardIssuedRef.current = true;
        onComplete();
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [open, onComplete]);

  const remainingSeconds = useMemo(
    () => Math.ceil(remainingMs / 1000),
    [remainingMs],
  );
  const selectedVideo = AD_VIDEOS[videoIndex] || AD_VIDEOS[0];

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 p-3">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-3 space-y-3">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center"
            aria-label="Close ad"
          >
            &times;
          </button>
        )}

        <div className="pr-8">
          <p className="text-sm font-semibold text-white">Rewarded video</p>
          <p className="text-xs text-subtext">
            {rewardIssuedRef.current
              ? 'Reward unlocked. You can close now or keep watching.'
              : `Stay for ${remainingSeconds}s to unlock your reward.`}
          </p>
        </div>

        <div className="aspect-[9/16] w-full overflow-hidden rounded-lg border border-border bg-black">
          <iframe
            src={selectedVideo.iframeUrl}
            title="Rewarded TikTok"
            className="w-full h-full"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        <button
          type="button"
          onClick={() => setVideoIndex((current) => (current + 1) % AD_VIDEOS.length)}
          className="text-center text-xs text-brand-gold underline"
        >
          Video unavailable? Try another one
        </button>

        <a
          href={selectedVideo.fallbackUrl}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs text-blue-300 underline"
        >
          Open video directly if embed does not load
        </a>
      </div>
    </div>
  );
}
