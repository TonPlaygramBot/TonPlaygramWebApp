import { useEffect, useState } from 'react';
import { ADSGRAM_WALLET } from '../utils/constants.js';

interface AdModalProps {
  open: boolean;
  onComplete: () => void;
  onClose?: () => void;
}

export default function AdModal({ open, onComplete, onClose }: AdModalProps) {
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!open) {
      setFallback(false);
      return;
    }
    const sdk = (window as any).AdsgramSDK;
    if (sdk?.createVideoAd) {
      const ad = sdk.createVideoAd({
        containerId: 'adsgram-player',
        walletAddress: ADSGRAM_WALLET,
      });

      const handleFinish = () => {
        onComplete();
      };

      ad.on?.('finish', handleFinish);
      // Some versions emit 'close' or 'complete' when the ad ends
      ad.on?.('close', handleFinish);
      ad.on?.('complete', handleFinish);

      return () => {
        ad.off?.('finish', handleFinish);
        ad.off?.('close', handleFinish);
        ad.off?.('complete', handleFinish);
        ad.destroy?.();
      };
    } else {
      setFallback(true);
    }
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-6 rounded text-center space-y-4 text-text w-80 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
          >
            &times;
          </button>
        )}
        <img
          src="/assets/TonPlayGramLogo.jpg"
          alt="TonPlaygram Logo"
          loading="lazy"
          className="w-10 h-10 mx-auto"
        />
        <h3 className="text-lg font-bold">Watch Ad</h3>
        <div
          id="adsgram-player"
          className={`w-full h-40 bg-black ${fallback ? 'hidden' : ''}`}
        />
        {fallback && (
          <video
            className="w-full h-40"
            autoPlay
            controls
            onEnded={onComplete}
            src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm"
          />
        )}
        <p className="text-sm text-subtext">Watch the ad completely to unlock the spin.</p>
      </div>
    </div>
  );
}
