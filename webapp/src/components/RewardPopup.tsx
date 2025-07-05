import { useEffect } from 'react';
import { getGameVolume } from '../utils/sound.js';
import CoinBurst from './CoinBurst.tsx';
import { Segment } from '../utils/rewardLogic';

interface RewardPopupProps {
  reward: Segment | null;
  onClose: () => void;
  message?: string;
}

export default function RewardPopup({ reward, onClose, message }: RewardPopupProps) {
  if (reward === null) return null;
  useEffect(() => {
    function playCoinSound() {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(880, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
        g.gain.setValueAtTime(getGameVolume(), ctx.currentTime);
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.2);
      } catch {}
    }
    playCoinSound();
  }, []);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <CoinBurst />
      <div className="bg-surface border border-border p-6 rounded text-center space-y-4 text-text w-80">
        <img
          loading="lazy"
          src="/assets/TonPlayGramLogo.jpg"
          alt="TonPlaygram Logo"
          className="w-10 h-10 mx-auto"
        />
        <h3 className="text-lg font-bold">Reward Earned</h3>
        <div className="text-accent text-3xl">
          {reward === 'BONUS_X3' && 'BONUS X3'}
          {typeof reward === 'number' && reward === 1600 && '+1 Free Spin'}
          {typeof reward === 'number' && reward === 1800 && '+2 Free Spins'}
          {typeof reward === 'number' && reward !== 1600 && reward !== 1800 && `+${reward} TPC`}
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
