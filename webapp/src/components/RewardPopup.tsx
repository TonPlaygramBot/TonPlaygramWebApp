import { useEffect } from 'react';

interface RewardPopupProps {
  reward: number | null;
  onClose: () => void;
  message?: string;
}

export default function RewardPopup({ reward, onClose, message }: RewardPopupProps) {
  if (reward === null) return null;
  useEffect(() => {
    import('canvas-confetti').then(({ default: confetti }) =>
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } })
    );
  }, []);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-6 rounded text-center space-y-4 text-text w-80">
        <img
          src="/assets/TonPlayGramLogo.jpg"
          alt="TonPlaygram Logo"
          className="w-10 h-10 mx-auto"
        />
        <h3 className="text-lg font-bold">Reward Earned</h3>
        <div className="text-accent text-3xl">+{reward} TPC</div>
        {message && <p className="text-sm text-subtext">{message}</p>}
        <button
          onClick={onClose}
          className="px-4 py-1 bg-primary hover:bg-primary-hover text-white rounded w-full"
        >
          Close
        </button>
      </div>
    </div>
  );
}
