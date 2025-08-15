import { useEffect } from 'react';
import { getGameVolume } from '../utils/sound.js';
import coinConfetti from '../utils/coinConfetti';
import { Segment } from '../utils/rewardLogic';

interface RewardPopupProps {
  reward: Segment | null;
  onClose: () => void;
  duration?: number;
  showCloseButton?: boolean;
  disableEffects?: boolean;
}

export default function RewardPopup({
  reward,
  onClose,
  duration = 2500,
  showCloseButton = true,
  disableEffects = false,
}: RewardPopupProps) {
  if (reward === null) return null;
  useEffect(() => {
    let audio: HTMLAudioElement | undefined;
    if (!disableEffects) {
      let icon = '/assets/icons/ezgif-54c96d8a9b9236.webp';
      if (reward === 'BONUS_X3') {
        icon = '/assets/icons/file_00000000ead061faa3b429466e006f48.webp';
      } else if (reward === 'FREE_SPIN') {
        icon = '/assets/icons/file_00000000ae68620a96d269fe76d158e5_256x256.webp';
      }
      coinConfetti(50, icon);
      audio = new Audio('/assets/sounds/man-cheering-in-victory-epic-stock-media-1-00-01.mp3');
      audio.volume = getGameVolume();
      audio.play().catch(() => {});
    }
    const timer = setTimeout(onClose, duration);
    return () => {
      if (audio) audio.pause();
      clearTimeout(timer);
    };
  }, [onClose, duration, reward, disableEffects]);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="text-center space-y-4 text-text">
        <h3 className="text-lg font-bold text-red-600 drop-shadow-[0_0_2px_black]">
          Reward Earned
        </h3>
        <div className="text-accent text-3xl flex items-center justify-center space-x-2">
          {reward === 'BONUS_X3' && (
            <>
              <img

                src="/assets/icons/file_000000009160620a96f728f463de1c3f.webp"
                alt="Bonus"
                className="w-8 h-8"
              />
              <span>BONUS X3</span>
            </>
          )}
          {reward === 'FREE_SPIN' && (
            <>
              <img
                src="/assets/icons/file_00000000ae68620a96d269fe76d158e5_256x256.webp"
                alt="Free Spin"
                className="w-8 h-8"
              />
              <span>+2</span>
            </>
          )}
          {typeof reward === 'number' && (
            <>
              <img

                src="/assets/icons/ezgif-54c96d8a9b9236.webp"
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
