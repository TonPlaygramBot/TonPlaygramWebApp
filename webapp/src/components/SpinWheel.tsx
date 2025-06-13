import { useState } from 'react';
import { segments, getRandomReward } from '../utils/rewardLogic';

interface SpinWheelProps {
  onFinish: (reward: number) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  disabled?: boolean;
}

const itemHeight = 60; // px height of each prize row
const visibleRows = 5;
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
    <div className="relative w-32 mx-auto flex flex-col items-center">
      {/* Top pointer */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-yellow-500" />
      {/* Bottom pointer */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-yellow-500" />

      {/* Slot container */}
      <div
        className="overflow-hidden w-full border-4 border-yellow-500 rounded bg-gray-900 flex items-center justify-center"
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
              className={`h-[60px] flex items-center justify-center text-sm w-full ${
                idx === winnerIndex ? 'bg-yellow-600 text-white' : 'text-yellow-400'
              }`}
            >
              <img src="/icons/tpc.svg" alt="TPC" className="w-4 h-4 mr-1" />
              <span>{val}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={spin}
        className="mt-4 px-4 py-1 bg-green-600 text-white text-sm font-bold rounded disabled:bg-gray-500"
        disabled={spinning || disabled}
      >
        Spin
      </button>
    </div>
  );
}
