import { useState } from 'react';
import { segments, getRandomReward } from '../utils/rewardLogic';

interface SpinWheelProps {
  onFinish: (reward: number) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  disabled?: boolean;
}

const segmentAngle = 360 / segments.length;

export default function SpinWheel({ onFinish, spinning, setSpinning, disabled }: SpinWheelProps) {
  const [angle, setAngle] = useState(0);

  const spin = () => {
    if (spinning || disabled) return;
    const reward = getRandomReward();
    const index = segments.indexOf(reward);
    const rotations = 4;
    const final = rotations * 360 + index * segmentAngle + segmentAngle / 2;
    setAngle(final);
    setSpinning(true);
    setTimeout(() => {
      setSpinning(false);
      onFinish(reward);
    }, 4000);
  };

  return (
    <div className="relative w-64 h-64">
      <div
        className="w-full h-full rounded-full border-4 border-yellow-500 flex items-center justify-center transition-transform duration-[4000ms]"
        style={{
          transform: `rotate(${angle}deg)`,
          backgroundImage:
            'conic-gradient(#333 0deg 45deg, #111 45deg 90deg, #333 90deg 135deg, #111 135deg 180deg, #333 180deg 225deg, #111 225deg 270deg, #333 270deg 315deg, #111 315deg 360deg)'
        }}
      >
        {segments.map((s, i) => (
          <span
            key={i}
            className="absolute text-yellow-400 text-sm"
            style={{
              transform: `rotate(${i * segmentAngle}deg) translateY(-110px)`
            }}
          >
            {s}
          </span>
        ))}
      </div>
      <button
        onClick={spin}
        className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-4 py-2 rounded bg-yellow-500 text-black disabled:bg-gray-500"
        disabled={spinning || disabled}
      >
        Spin
      </button>
    </div>
  );
}
