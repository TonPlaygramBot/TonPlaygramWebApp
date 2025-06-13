import { useState } from 'react';
import { segments, getRandomReward } from '../utils/rewardLogic';

interface SpinWheelProps {
  onFinish: (reward: number) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  disabled?: boolean;
}

const segmentAngle = 360 / segments.length;

export default function SpinWheel({
  onFinish,
  spinning,
  setSpinning,
  disabled
}: SpinWheelProps) {
  const [angle, setAngle] = useState(0);

  const spin = () => {
    if (spinning || disabled) return;

    const reward = getRandomReward();
    const index = segments.indexOf(reward);
    const rotations = 5;

    // Make sure the reward lands exactly at the top (centered under the arrow)
    const finalAngle =
      rotations * 360 + (index * segmentAngle * -1) + segmentAngle / 2;

    setAngle(finalAngle);
    setSpinning(true);

    setTimeout(() => {
      setSpinning(false);
      onFinish(reward);
    }, 4000);
  };

  return (
    <div className="relative w-64 h-64 mx-auto">
      {/* Arrow (top center, pointing down) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 
                      w-0 h-0 border-l-8 border-r-8 border-b-[16px] 
                      border-l-transparent border-r-transparent border-b-yellow-500 z-10" />

      {/* Spinning Wheel */}
      <div
        className="w-full h-full rounded-full border-4 border-yellow-500 
                   flex items-center justify-center transition-transform 
                   duration-[4000ms]"
        style={{
          transform: `rotate(${angle}deg)`,
          backgroundImage:
            'conic-gradient(from 0deg, #333 0deg 45deg, #111 45deg 90deg, #333 90deg 135deg, #111 135deg 180deg, #333 180deg 225deg, #111 225deg 270deg, #333 270deg 315deg, #111 315deg 360deg)'
        }}
      >
        {segments.map((s, i) => (
          <div
            key={i}
            className="absolute flex items-center justify-center text-yellow-400 text-sm"
            style={{
              transform: `rotate(${i * segmentAngle}deg) translateY(-90px) rotate(${-i * segmentAngle}deg)`
            }}
          >
            <img src="/icons/tpc.svg" alt="TPC" className="w-4 h-4 mr-1" />
            <span>{s}</span>
          </div>
        ))}
      </div>

      {/* Spin Button */}
      <button
        onClick={spin}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                   w-16 h-16 rounded-full bg-green-600 text-white text-sm font-bold 
                   flex items-center justify-center disabled:bg-gray-500"
        disabled={spinning || disabled}
      >
        Spin
      </button>
    </div>
  );
}
