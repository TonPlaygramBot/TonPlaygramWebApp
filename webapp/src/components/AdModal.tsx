import { useEffect, useMemo, useState } from 'react';

const AD_IFRAME_URL = 'https://vt.tiktok.com/ZSuREWyqx/';
const REWARD_SECONDS = 15;

interface AdModalProps {
  open: boolean;
  onComplete: () => void;
  onClose?: () => void;
}

export default function AdModal({ open, onComplete, onClose }: AdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(REWARD_SECONDS);
  const [rewardIssued, setRewardIssued] = useState(false);
  const [sessionId, setSessionId] = useState(0);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(REWARD_SECONDS);
    setRewardIssued(false);
    setSessionId((prev) => prev + 1);
  }, [open]);

  useEffect(() => {
    if (!open || rewardIssued) return;

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          if (!rewardIssued) {
            setRewardIssued(true);
            onComplete();
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [open, onComplete, rewardIssued]);

  const counterLabel = useMemo(() => {
    if (rewardIssued) return 'Reward unlocked. You can close now or continue watching.';
    return `Reward unlocks in ${secondsLeft}s`;
  }, [rewardIssued, secondsLeft]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="relative w-[min(92vw,420px)] h-[min(72vh,740px)] rounded-2xl overflow-hidden border border-white/20 bg-black">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-10 bg-black bg-opacity-70 text-white rounded-full w-7 h-7 flex items-center justify-center"
            aria-label="Close ad"
          >
            &times;
          </button>
        )}
        <iframe
          key={sessionId}
          src={AD_IFRAME_URL}
          title="Rewarded ad"
          className="w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture; web-share"
        />
        <div className="absolute bottom-0 inset-x-0 bg-black/75 text-white text-xs px-3 py-2 text-center">
          {counterLabel}
        </div>
      </div>
    </div>
  );
}
