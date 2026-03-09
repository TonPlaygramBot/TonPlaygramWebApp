import { useEffect, useMemo, useRef, useState } from 'react';

const AD_VIDEO_ID = '7614838290667031816';
const AD_PLAYER_URL = `https://www.tiktok.com/player/v1/${AD_VIDEO_ID}?autoplay=1&rel=0`;
const AD_CANONICAL_URL = `https://www.tiktok.com/@tonplaygram/video/${AD_VIDEO_ID}`;
const REWARD_DELAY_MS = 15_000;

interface AdModalProps {
  open: boolean;
  onComplete: () => void;
  onClose?: () => void;
}

export default function AdModal({ open, onComplete, onClose }: AdModalProps) {
  const rewardIssuedRef = useRef(false);
  const [remainingMs, setRemainingMs] = useState(REWARD_DELAY_MS);
  const [showOpenLinkHint, setShowOpenLinkHint] = useState(false);

  useEffect(() => {
    if (!open) {
      rewardIssuedRef.current = false;
      setRemainingMs(REWARD_DELAY_MS);
      setShowOpenLinkHint(false);
      return;
    }

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

    const fallbackHintId = window.setTimeout(() => {
      setShowOpenLinkHint(true);
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(fallbackHintId);
    };
  }, [open, onComplete]);

  const remainingSeconds = useMemo(
    () => Math.ceil(remainingMs / 1000),
    [remainingMs],
  );

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

        <div className="aspect-[9/16] w-full overflow-hidden rounded-lg border border-border bg-black relative">
          <iframe
            src={AD_PLAYER_URL}
            title="Rewarded TikTok"
            className="w-full h-full"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>

        {showOpenLinkHint && (
          <p className="text-center text-[11px] text-yellow-300">
            If your device blocks preview playback, open the video directly in TikTok.
          </p>
        )}

        <a
          href={AD_CANONICAL_URL}
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
