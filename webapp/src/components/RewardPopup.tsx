import { useEffect } from 'react';
import { getGameVolume } from '../utils/sound.js';
import coinConfetti from '../utils/coinConfetti';
import { Segment } from '../utils/rewardLogic';

interface RewardPopupProps {
  reward: Segment | null;
  onClose: () => void;
  duration?: number;
  showCloseButton?: boolean;
}

export default function RewardPopup({ reward, onClose, duration = 2500, showCloseButton = true }: RewardPopupProps) {
  if (reward === null) return null;
  useEffect(() => {
    coinConfetti(50);
    const audio = new Audio('/assets/sounds/man-cheering-in-victory-epic-stock-media-1-00-01.mp3');
    audio.volume = getGameVolume();
    audio.play().catch(() => {});
    const timer = setTimeout(onClose, duration);
    return () => {
      audio.pause();
      clearTimeout(timer);
    };
  }, [onClose, duration]);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="text-center space-y-4 text-text">
        <h3 className="text-lg font-bold">Reward Earned</h3>
        <div className="text-accent text-3xl flex items-center justify-center space-x-2">
          {reward === 'BONUS_X3' && (
            <>
              <img

                src="/assets/icons/file_00000000eeb061f79122a7d007f9bddc.webp"
                alt="Bonus"
                className="w-8 h-8"
              />
              <span>BONUS X3</span>
            </>
          )}
          {typeof reward === 'number' && reward === 1600 && (
            <>
              <img
                
                src="/assets/icons/FreeSpin.png"
                alt="Free Spin"
                className="w-8 h-8"
              />
              <span>+1</span>
            </>
          )}
          {typeof reward === 'number' && reward === 1800 && (
            <>
              <img
                
                src="/assets/icons/FreeSpin.png"
                alt="Free Spin"
                className="w-8 h-8"
              />
              <span>+2</span>
            </>
          )}
          {typeof reward === 'number' && reward !== 1600 && reward !== 1800 && (
            <>
              <img
                
                src="/assets/icons/TPCcoin_1.webp"
                alt="TPC"
                className="w-8 h-8"
              />
              <span>+{reward}</span>
            </>
          )}
        </div>
        {showCloseButton && (
          <button
            onClick={onClose}
            className="px-4 py-1 bg-primary hover:bg-primary-hover text-white rounded w-full"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
