import { forwardRef, useImperativeHandle } from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { getGameVolume } from '../utils/sound.js';

import { segments as baseSegments, Segment } from '../utils/rewardLogic';

export interface SpinWheelHandle {
  spin: () => void;
}

interface SpinWheelProps {
  onFinish: (reward: Segment) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  segments?: Segment[];
  disabled?: boolean;
  showButton?: boolean;
  disableSound?: boolean;
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
    segments,
    disabled,
    showButton = true,
    disableSound = false,
  }: SpinWheelProps,
  ref
) {

  const [offset, setOffset] = useState(0);

  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);

  const spinCountRef = useRef(0);

  const shuffleSegments = (arr: Segment[]) =>
    arr
      .map((a) => [Math.random(), a] as [number, Segment])
      .sort((a, b) => a[0] - b[0])
      .map((x) => x[1]);

  const [wheelSegments, setWheelSegments] = useState<Segment[]>(() =>
    shuffleSegments(segments ?? baseSegments)
  );

  useEffect(() => {
    setWheelSegments(shuffleSegments(segments ?? baseSegments));
  }, [segments]);

  const spinSoundRef = useRef<HTMLAudioElement | null>(null);
  const successSoundRef = useRef<HTMLAudioElement | null>(null);
  const bonusSoundRef = useRef<HTMLAudioElement | null>(null);
  const extraBonusSoundRef1 = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (disableSound) return;
    spinSoundRef.current = new Audio('/assets/sounds/spinning.mp3');
    spinSoundRef.current.preload = 'auto';
    spinSoundRef.current.loop = true;
    spinSoundRef.current.volume = getGameVolume();
    successSoundRef.current = new Audio('/assets/sounds/successful.mp3');
    successSoundRef.current.preload = 'auto';
    successSoundRef.current.volume = getGameVolume();
    bonusSoundRef.current = new Audio('/assets/sounds/yabba-dabba-doo.mp3');
    bonusSoundRef.current.preload = 'auto';
    bonusSoundRef.current.volume = getGameVolume();
    extraBonusSoundRef1.current = new Audio('/assets/sounds/happy-noisesmp3-14568.mp3');
    extraBonusSoundRef1.current.preload = 'auto';
    extraBonusSoundRef1.current.volume = getGameVolume();
    return () => {
      spinSoundRef.current?.pause();
      successSoundRef.current?.pause();
      bonusSoundRef.current?.pause();
      extraBonusSoundRef1.current?.pause();
    };
  }, [disableSound]);

  useEffect(() => {
    if (disableSound) return;
    const handler = () => {
      if (spinSoundRef.current) spinSoundRef.current.volume = getGameVolume();
      if (successSoundRef.current) successSoundRef.current.volume = getGameVolume();
      if (bonusSoundRef.current) bonusSoundRef.current.volume = getGameVolume();
      if (extraBonusSoundRef1.current) extraBonusSoundRef1.current.volume = getGameVolume();
    };
    window.addEventListener('gameVolumeChanged', handler);
    return () => window.removeEventListener('gameVolumeChanged', handler);
  }, [disableSound]);

  const items = useMemo(
    () =>
      Array.from(
        { length: wheelSegments.length * loops * maxSpins + visibleRows },
        (_, i) => wheelSegments[i % wheelSegments.length]
      ),
    [wheelSegments]
  );

  const spin = () => {

    if (spinning || disabled) return;
    if (!disableSound && spinSoundRef.current) {
      spinSoundRef.current.currentTime = 0;
      spinSoundRef.current.play().catch(() => {});
    }

    const index = Math.floor(Math.random() * wheelSegments.length);

    const reward = wheelSegments[index];

    spinCountRef.current += 1;
    const finalIndex = spinCountRef.current * loops * wheelSegments.length + index;

    const finalOffset = -(finalIndex - winningRow) * itemHeight;

    setOffset(finalOffset);

    setSpinning(true);

    setWinnerIndex(null);

    setTimeout(() => {
      if (!disableSound) {
        spinSoundRef.current?.pause();
        if (spinSoundRef.current) spinSoundRef.current.currentTime = 0;
      }

      setSpinning(false);
      setWinnerIndex(finalIndex);

      if (!disableSound) {
        if (reward === 'BONUS_X3') {
          bonusSoundRef.current?.play().catch(() => {});
          extraBonusSoundRef1.current?.play().catch(() => {});
          if (successSoundRef.current) {
            successSoundRef.current.currentTime = 0;
            successSoundRef.current.play().catch(() => {});
          }
        } else if (successSoundRef.current) {
          successSoundRef.current.currentTime = 0;
          successSoundRef.current.play().catch(() => {});
        }
      }
      onFinish(reward);
    }, 4000);
  };

  useImperativeHandle(ref, () => ({ spin }));

  return (

    <div className="w-28 flex flex-col items-center">

      <div

        className="relative overflow-hidden w-28"

        style={{ height: itemHeight * visibleRows }}

      >

        {/* Highlight the winning (3rd) row */}

        <div

          className="absolute inset-x-0 border-4 border-brand-gold pointer-events-none z-10 shadow-[0_0_12px_rgba(241,196,15,0.8)]"

          style={{ top: itemHeight * winningRow, height: itemHeight }}

        />

        <div

          className="flex flex-col items-center w-28"

          style={{

            transform: `translateY(${offset}px)`,

            transition: 'transform 4s cubic-bezier(0.33,1,0.68,1)'

          }}

        >

          {items.map((val, idx) => (

            <div
              key={idx}
              className={`board-style border-2 border-border text-sm w-28 font-bold flex items-center ${
                val === 'BONUS_X3' || val === 'FREE_SPIN'
                  ? 'justify-center'
                  : 'justify-center space-x-1'
              } ${
                idx === winnerIndex ? 'bg-yellow-300 text-black border-4 border-brand-gold shadow-[0_0_12px_rgba(241,196,15,0.8)]' : 'text-white'
              }`}
              style={{ height: itemHeight }}
            >
              {val === 'BONUS_X3' ? (
                <span className="text-red-600 font-bold drop-shadow-[0_0_2px_black]">
                  BONUS X3
                </span>
              ) : val === 'FREE_SPIN' ? (
                <>
                  <img
                    src="/assets/icons/file_00000000ae68620a96d269fe76d158e5_256x256.webp"
                    alt="Free Spin"
                    className="w-8 h-8"
                  />
                  <span>+2</span>
                </>
              ) : (
                <>
                  <img src="/assets/icons/eab316f3-7625-42b2-9468-d421f81c4d7c.webp" alt="TPC" className="w-8 h-8" />
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
