import { useState, forwardRef, useImperativeHandle } from 'react';

import { segments } from '../utils/rewardLogic';

export interface SpinWheelHandle {
  spin: () => void;
}

interface SpinWheelProps {

  onFinish: (reward: number) => void;

  spinning: boolean;

  setSpinning: (b: boolean) => void;

  disabled?: boolean;
  showButton?: boolean;
}

// Slot machine style settings

const itemHeight = 40; // Height per prize row in pixels

const visibleRows = 7; // Always display 7 rows

const winningRow = 2;  // Index of the row that marks the winner (3rd row)

const loops = 8;       // How many times the list repeats while spinning

export default forwardRef<SpinWheelHandle, SpinWheelProps>(function SpinWheel(
  {
    onFinish,
    spinning,
    setSpinning,
    disabled,
    showButton = true,
  }: SpinWheelProps,
  ref
) {

  const [offset, setOffset] = useState(0);

  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);

  const items = Array.from(

    { length: segments.length * loops + visibleRows },

    (_, i) => segments[i % segments.length]

  );

  const spin = () => {

    if (spinning || disabled) return;

    const index = Math.floor(Math.random() * segments.length);

    const reward = segments[index];

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

  useImperativeHandle(ref, () => ({ spin }));

  return (

    <div className="w-40 mx-auto flex flex-col items-center">

      <div

        className="relative overflow-hidden w-full"

        style={{ height: itemHeight * visibleRows }}

      >

        {/* Highlight the winning (3rd) row */}

        <div

          className="absolute inset-x-0 border-2 border-yellow-500 pointer-events-none z-10"

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

              className={`flex items-center justify-center text-sm w-full font-bold ${

                idx === winnerIndex ? 'bg-yellow-500 text-white' : 'text-white'

              }`}

              style={{ height: itemHeight }}

            >

              <img src="/icons/tpc.svg" alt="TPC" className="w-5 h-5 mr-1" />

              <span>{val}</span>

            </div>

          ))}

        </div>

      </div>
      {showButton && (
        <button
          onClick={spin}
          className="mt-4 px-4 py-1 bg-green-600 text-white text-sm font-bold rounded disabled:bg-gray-500"
          disabled={spinning || disabled}
        >
          Spin
        </button>
      )}

    </div>

  );

});
