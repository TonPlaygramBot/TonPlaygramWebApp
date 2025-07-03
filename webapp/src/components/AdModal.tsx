import { useEffect } from 'react';
import { ADSGRAM_WALLET } from '../utils/constants.js';

interface AdModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function AdModal({ open, onClose, onComplete }: AdModalProps) {
  useEffect(() => {
    if (!open) return;
    const sdk = (window as any).AdsgramSDK;
    if (sdk?.createVideoAd) {
      const ad = sdk.createVideoAd({
        containerId: 'adsgram-player',
        walletAddress: ADSGRAM_WALLET,
      });
      ad.on('finish', () => {
        onComplete();
      });
      return () => ad.destroy?.();
    }
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-6 rounded text-center space-y-4 text-text w-80">
        <img src="/assets/TonPlayGramLogo.jpg" alt="TonPlaygram Logo" className="w-10 h-10 mx-auto" />
        <h3 className="text-lg font-bold">Watch Ad</h3>
        <div id="adsgram-player" className="w-full h-40 bg-black" />
        <video
          className="w-full h-40"
          autoPlay
          controls
          onEnded={onComplete}
          src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm"
        />
        <p className="text-sm text-subtext">Watch the ad completely to unlock the spin.</p>
        <button onClick={onClose} className="px-4 py-1 bg-primary hover:bg-primary-hover text-white rounded w-full">
          Close
        </button>
      </div>
    </div>
  );
}
