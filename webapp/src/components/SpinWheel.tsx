import { useState } from 'react';
import { segments } from '../utils/rewardLogic';

interface SpinWheelProps {
  onFinish: (reward: number) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  disabled?: boolean;
}

const visibleCount = 6;          // Show 6 prize amounts
const wheelSize = 240;           // Diameter of the wheel in pixels
const loops = 6;                 // Full rotations during a spin for drama

export default function SpinWheel({
  onFinish,
  spinning,
  setSpinning,
  disabled
}: SpinWheelProps) {
  const prizes = segments.slice(0, visibleCount);
  const wedge = 360 / prizes.length;
  const [rotation, setRotation] = useState(-90); // start with first prize on top

  const spin = () => {
    if (spinning || disabled) return;

    const index = Math.floor(Math.random() * prizes.length);
    const reward = prizes[index];

    const finalRotation = rotation - loops * 360 - index * wedge;

    setRotation(finalRotation);
    setSpinning(true);

    setTimeout(() => {
      setSpinning(false);
      onFinish(reward);
    }, 4000);
  };

  return (
    <div className="mx-auto flex flex-col items-center" style={{ width: wheelSize }}>
      <div className="relative" style={{ width: wheelSize, height: wheelSize }}>
        <div
          className="absolute inset-0 rounded-full border-4 border-yellow-500"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 4s cubic-bezier(0.33,1,0.68,1)'
          }}
        >
          {prizes.map((val, idx) => {
            const angle = idx * wedge;
            const r = wheelSize / 2 - 20;
            return (
              <div
                key={idx}
                className="absolute left-1/2 top-1/2 text-yellow-400 text-xs font-semibold"
                style={{
                  transform: `rotate(${angle}deg) translate(${r}px) rotate(-${angle}deg)`
                }}
              >
                {val}
              </div>
            );
          })}
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
