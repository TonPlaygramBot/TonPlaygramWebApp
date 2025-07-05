import { useEffect } from 'react';
import { getGameVolume } from '../utils/sound.js';
import confetti from 'canvas-confetti';
import { Segment } from '../utils/rewardLogic';

interface RewardPopupProps {
  reward: Segment | null;
  onClose: () => void;
  message?: string;
}

export default function RewardPopup({ reward, onClose, message }: RewardPopupProps) {
  if (reward === null) return null;
  useEffect(() => {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    const audio = new Audio('/assets/sounds/man-cheering-in-victory-epic-stock-media-1-00-01.mp3');
    audio.volume = getGameVolume();
    audio.play().catch(() => {});
    return () => {
      audio.pause();
    };
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
        <div className="text-accent text-3xl">
          {reward === 'BONUS_X3' && 'BONUS X3'}
          {typeof reward === 'number' && reward === 1600 && '+1 Free Spin'}
          {typeof reward === 'number' && reward === 1800 && '+2 Free Spins'}
          {typeof reward === 'number' && reward === 5000 && '+3 Free Spins'}
          {typeof reward === 'number' && reward !== 1600 && reward !== 1800 && reward !== 5000 && `+${reward} TPC`}
        </div>
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
