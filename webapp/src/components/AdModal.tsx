import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_AD_VIDEO_ID = '7614838290667031816';
const REWARD_DELAY_MS = 15_000;

interface AdModalProps {
  open: boolean;
  onComplete: () => void;
  onClose?: () => void;
  videoId?: string;
}

export default function AdModal({
  open,
  onComplete,
  onClose,
  videoId = DEFAULT_AD_VIDEO_ID,
}: AdModalProps) {
  const rewardIssuedRef = useRef(false);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const [remainingMs, setRemainingMs] = useState(REWARD_DELAY_MS);
  const [showOpenLinkHint, setShowOpenLinkHint] = useState(false);
  // Muted, inline playback is required for autoplay in iOS and Android webviews.
  const playerUrl = useMemo(
    () =>
      `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&muted=1&loop=1&playsinline=1&rel=0`,
    [videoId],
  );
  const canonicalUrl = useMemo(
    () => `https://www.tiktok.com/@tonplaygram/video/${videoId}`,
    [videoId],
  );

  const requestPlayback = useCallback(() => {
    playerRef.current?.contentWindow?.postMessage(
      { type: 'play', value: undefined },
      'https://www.tiktok.com',
    );
  }, []);

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

  useEffect(() => {
    if (!open) return;

    // The player can finish loading after the autoplay query is first handled.
    // Keep retrying through TikTok's player API while slower mobile webviews
    // initialise the iframe, and play again as soon as the player reports ready.
    const retryIds = [250, 750, 1500, 3000, 5000, 7500].map((delay) =>
      window.setTimeout(requestPlayback, delay),
    );
    const handlePlayerMessage = (event: MessageEvent) => {
      if (
        event.origin !== 'https://www.tiktok.com' ||
        event.source !== playerRef.current?.contentWindow
      ) {
        return;
      }

      const messageType = event.data?.type;
      if (messageType === 'onPlayerReady' || messageType === 'playerReady') {
        requestPlayback();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestPlayback();
    };
    window.addEventListener('message', handlePlayerMessage);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      retryIds.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('message', handlePlayerMessage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [open, playerUrl, requestPlayback]);

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
            ref={playerRef}
            key={playerUrl}
            src={playerUrl}
            title="Rewarded TikTok"
            className="w-full h-full"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={requestPlayback}
          />
        </div>

        {showOpenLinkHint && (
          <p className="text-center text-[11px] text-yellow-300">
            If your device blocks preview playback, open the video directly in TikTok.
          </p>
        )}

        <a
          href={canonicalUrl}
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
