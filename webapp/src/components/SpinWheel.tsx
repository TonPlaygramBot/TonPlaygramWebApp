import {  forwardRef, useImperativeHandle } from 'react';
import { useState, useEffect, useRef } from 'react';
import { getGameVolume } from '../utils/sound.js';

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
const maxSpins = 50;    // Pre-generated spins to allow continuous play

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

  const spinCountRef = useRef(0);

  const spinSoundRef = useRef<HTMLAudioElement | null>(null);
  const successSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    spinSoundRef.current = new Audio('/assets/sounds/spinning.mp3');
    spinSoundRef.current.preload = 'auto';
    spinSoundRef.current.volume = getGameVolume();
    successSoundRef.current = new Audio('/assets/sounds/successful.mp3');
    successSoundRef.current.preload = 'auto';
    successSoundRef.current.volume = getGameVolume();
    return () => {
      spinSoundRef.current?.pause();
      successSoundRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (spinSoundRef.current) spinSoundRef.current.volume = getGameVolume();
      if (successSoundRef.current) successSoundRef.current.volume = getGameVolume();
    };
    window.addEventListener('gameVolumeChanged', handler);
    return () => window.removeEventListener('gameVolumeChanged', handler);
  }, []);

  const items = Array.from(
    { length: segments.length * loops * maxSpins + visibleRows },
    (_, i) => segments[i % segments.length]
  );

  const spin = () => {

    if (spinning || disabled) return;
    if (spinSoundRef.current) {
      spinSoundRef.current.currentTime = 0;
      spinSoundRef.current.play().catch(() => {});
    }

    const index = Math.floor(Math.random() * segments.length);

    const reward = segments[index];

    spinCountRef.current += 1;
    const finalIndex = spinCountRef.current * loops * segments.length + index;

    const finalOffset = -(finalIndex - winningRow) * itemHeight;

    setOffset(finalOffset);

    setSpinning(true);

    setWinnerIndex(null);

    setTimeout(() => {
      spinSoundRef.current?.pause();
      if (spinSoundRef.current) spinSoundRef.current.currentTime = 0;

      setSpinning(false);
      setWinnerIndex(finalIndex);

      if (successSoundRef.current) {
        successSoundRef.current.currentTime = 0;
        successSoundRef.current.play().catch(() => {});
      }
      onFinish(reward);
    }, 4000);
  };

  useImperativeHandle(ref, () => ({ spin }));

  return (

    <div className="w-36 mx-auto flex flex-col items-center">

      <div

        className="relative overflow-hidden w-32"

        style={{ height: itemHeight * visibleRows }}

      >

        {/* Highlight the winning (3rd) row */}

        <div

          className="absolute inset-x-0 border-2 border-yellow-300 pointer-events-none z-10"

          style={{ top: itemHeight * winningRow, height: itemHeight }}

        />

        <div

          className="flex flex-col items-center w-32"

          style={{

            transform: `translateY(${offset}px)`,

            transition: 'transform 4s cubic-bezier(0.33,1,0.68,1)'

          }}

        >

          {items.map((val, idx) => (

            <div

              key={idx}

              className={`board-style flex items-center justify-center text-sm w-32 font-bold ${

                idx === winnerIndex ? 'bg-yellow-300 text-black' : 'text-white'

              }`}

              style={{ height: itemHeight }}

            >

              {val === 1600 || val === 1800 || val === 5000 ? (
                <>
                  <img
                    src="/assets/icons/FreeSpin.png"
                    alt="Free Spin"
                    className="w-8 h-8 mr-1"
                  />
                  <span>
                    {val === 1600 && '1 Free Spin'}
                    {val === 1800 && '2 Free Spins'}
                    {val === 5000 && '3 Free Spins'}
                  </span>
                </>
              ) : (
                <>
                  <img src="/icons/TPCcoin.png" alt="TPC" className="w-8 h-8 mr-1" />
                  <span>{val >= 1000 ? `${val / 1000}k` : val}</span>
                </>
              )}

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
