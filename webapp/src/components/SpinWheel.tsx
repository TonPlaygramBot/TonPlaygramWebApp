import { useState } from 'react';
import { segments, getRandomReward } from '../utils/rewardLogic';

interface SpinWheelProps {
  onFinish: (reward: number) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  disabled?: boolean;
}

const itemHeight = 50; // px height of each prize row
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
    <div className="flex flex-col items-center w-full">
      <div
        className="overflow-hidden border-2 border-accent rounded-lg bg-surface mx-auto w-48"
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
              className={`flex items-center justify-center text-white font-semibold text-sm w-full ${
                idx === winnerIndex ? 'text-accent' : ''
              }`}
              style={{ height: itemHeight }}
            >
              <div className="hexagon w-5 h-5 bg-accent text-surface flex items-center justify-center mr-2 text-xs font-bold">
                P
              </div>
              <span>P {val}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={spin}
        className="mt-6 px-8 py-3 bg-gray-700 text-white rounded-full border border-accent font-bold disabled:opacity-50"
        disabled={spinning || disabled}
      >
        Spin
      </button>
    </div>
  );
}
