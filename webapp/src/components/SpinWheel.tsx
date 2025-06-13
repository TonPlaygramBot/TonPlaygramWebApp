import { useState } from 'react';
import { segments, getRandomReward } from '../utils/rewardLogic';

interface SpinWheelProps {
  onFinish: (reward: number) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  disabled?: boolean;
}

// Visual settings
const itemHeight = 40; // Each prize row is 40px tall
const visibleRows = 6; // Show 6 prize rows
const winningRow = 2;  // 3rd row is the winner
const loops = 12;      // Spin depth for drama

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
    const finalOffset = -(finalIndex - winningRow) * itemHeight;

    setOffset(finalOffset);
    setSpinning(true);
    setWinnerIndex(null);

    setTimeout(() => {
      setSpinning(false);
      setWinnerIndex(finalIndex);
      onFinish(reward);
    }, 4000);
  };

  const items = Array.from(
    { length: segments.length * loops + visibleRows + segments.length },
    (_, i) => segments[i % segments.length]
  );

  const wheelSize = itemHeight * visibleRows;

  return (
    <div className="relative mx-auto flex flex-col items-center" style={{ width: wheelSize }}>
      <div
        className="overflow-hidden rounded-full border-4 border-yellow-500 w-full"
        style={{ height: wheelSize }}
      >
        {/* Highlight the winning row */}
        <div
          className="absolute inset-x-0 border-2 border-yellow-500 pointer-events-none z-10 rounded-full"
          style={{ top: itemHeight * winningRow, height: itemHeight }}
        />
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
              className={`flex items-center justify-center text-sm w-full ${
                idx === winnerIndex ? 'bg-yellow-500 text-black font-bold' : 'text-yellow-400'
              }`}
              style={{ height: itemHeight }}
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
