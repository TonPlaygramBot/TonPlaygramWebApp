import { useState } from 'react';
import { segments, getRandomReward } from '../utils/rewardLogic';

interface SpinWheelProps {
  onFinish: (reward: number) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  disabled?: boolean;
}

const itemHeight = 60;
const visibleRows = 7;
const loops = 6;

export default function SpinWheel({
  onFinish,
  spinning,
  setSpinning,
  disabled
}: SpinWheelProps) {
  const [offset, setOffset] = useState(0);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);

  const spin = () => {
    if (spinning || disabled) return;

    const reward = getRandomReward();
    const index = segments.indexOf(reward);
    const finalIndex = loops * segments.length + index;
    const finalOffset = -(finalIndex - Math.floor(visibleRows / 2)) * itemHeight;

    setOffset(finalOffset);
    setWinnerIndex(null);
    setSpinning(true);

    setTimeout(() => {
      setSpinning(false);
      setWinnerIndex(finalIndex);
      onFinish(reward);
    }, 4000);
  };

  const items = Array.from(
    { length: segments.length * loops + visibleRows },
    (_, i) => segments[i % segments.length]
  );

  return (
    <div className="relative flex flex-col items-center w-full bg-gradient-to-b from-gray-900 to-black py-6 rounded-lg shadow-lg border border-yellow-600">
      {/* Top Pointer */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 
                      border-l-8 border-r-8 border-b-8 
                      border-l-transparent border-r-transparent border-b-yellow-500 z-10" />

      {/* Bottom Pointer */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 
                      border-l-8 border-r-8 border-t-8 
                      border-l-transparent border-r-transparent border-t-yellow-500 z-10" />

      {/* Slot Container */}
      <div
        className="overflow-hidden w-48 border-4 border-yellow-500 rounded bg-gray-900"
        style={{ height: itemHeight * visibleRows }}
      >
        <div
          className="flex flex-col items-center w-full"
          style={{
            transform: `translateY(${offset}px)`,
            transition: 'transform 4s cubic-bezier(0.33,1,0.68,1)'
          }}
        >
          {items.map((val, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-center text-sm font-semibold w-full ${
                idx === winnerIndex ? 'bg-yellow-600 text-white' : 'text-yellow-300'
              }`}
              style={{ height: itemHeight }}
            >
              <div className="w-6 h-6 mr-2 flex items-center justify-center bg-yellow-400 rounded-full text-black text-xs font-bold shadow-inner">
                ⬢
              </div>
              <span>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Spin Button */}
      <button
        onClick={spin}
        className="mt-6 px-6 py-2 bg-yellow-500 text-black rounded-full font-bold hover:bg-yellow-400 disabled:opacity-50"
        disabled={spinning || disabled}
      >
        Spin
      </button>
    </div>
  );
}
