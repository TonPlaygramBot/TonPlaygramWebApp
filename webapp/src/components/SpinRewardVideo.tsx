import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SOCIAL_CHANNELS } from '../config/socialChannels.js';

const REWARD_DELAY_MS = 15_000;
const INSTAGRAM_REELS_URL = `${SOCIAL_CHANNELS.find(({ id }) => id === 'instagram')?.url}/reels/`;

interface SpinRewardVideoProps {
  reelUrl: string | null;
  rewardOpen: boolean;
  onRewardComplete: () => void;
  onRewardClose: () => void;
}

export default function SpinRewardVideo({
  reelUrl,
  rewardOpen,
  onRewardComplete,
  onRewardClose,
}: SpinRewardVideoProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [remaining, setRemaining] = useState(REWARD_DELAY_MS / 1000);
  const completeRef = useRef(onRewardComplete);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const open = previewOpen || rewardOpen;
  const title = rewardOpen ? 'Instagram Reel · Spin reward' : 'Latest Instagram Reel';
  const close = rewardOpen ? onRewardClose : () => setPreviewOpen(false);
  const closeRef = useRef(close);

  useLayoutEffect(() => {
    completeRef.current = onRewardComplete;
    closeRef.current = close;
  });

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!rewardOpen) {
      setRemaining(REWARD_DELAY_MS / 1000);
      return;
    }

    const deadline = Date.now() + REWARD_DELAY_MS;
    const countdown = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);
    const finish = window.setTimeout(() => completeRef.current(), REWARD_DELAY_MS);

    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(finish);
    };
  }, [rewardOpen]);

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
            {rewardOpen && (
              <p className="pb-2 text-xs text-subtext">
                Spin unlocks in <strong>{remaining}s</strong>.
              </p>
            )}
            {reelUrl && (
              <iframe
                src={`${reelUrl}embed/`}
                title="TonPlaygram Instagram Reel"
                className="mx-auto aspect-[9/16] max-h-[65dvh] w-full shrink-0 rounded-lg border-0 bg-black"
                allow="autoplay; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            )}
            <a
              href={reelUrl || INSTAGRAM_REELS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-center text-sm font-semibold text-brand-gold"
            >
              {reelUrl ? 'Open Reel on Instagram' : 'Open @tonplaygram Reels on Instagram'}
            </a>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
