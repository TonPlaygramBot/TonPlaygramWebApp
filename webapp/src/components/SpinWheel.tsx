import { useState } from 'react';
import { segments, getRandomReward } from '../utils/rewardLogic';

interface SpinWheelProps {
  onFinish: (reward: number) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  disabled?: boolean;
}

// Visual settings for the wheel
const itemHeight = 50; // Height per row in pixels (slightly tighter spacing)
const visibleRows = 3; // Show only three prices with the middle as the winner
const loops = 8; // How many times the list repeats while spinning

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
    setSpinning(true);
    setWinnerIndex(null); // reset winner before spin

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
    <div className="relative w-40 mx-auto flex flex-col items-center">
      {/* Left pointer */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-0 h-0
                   border-t-8 border-b-8 border-r-8
                   border-t-transparent border-b-transparent border-r-yellow-500 z-10" />

      {/* Right pointer */}
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full w-0 h-0
                   border-t-8 border-b-8 border-l-8
                   border-t-transparent border-b-transparent border-l-yellow-500 z-10" />

      {/* Slot container */}
      <div
        className="overflow-hidden w-full"
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
              className={`flex items-center justify-center text-lg w-full ${
                idx === winnerIndex ? 'bg-yellow-500 text-black font-bold' : 'text-yellow-400'
              }`}
              style={{ height: itemHeight }}
            >
              <img src="/icons/tpc.svg" alt="TPC" className="w-5 h-5 mr-1" />
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
