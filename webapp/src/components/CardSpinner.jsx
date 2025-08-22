import { useState, useEffect, useRef } from 'react';
import { numericSegments, getLuckyReward } from '../utils/rewardLogic';
import { getGameVolume } from '../utils/sound.js';

const itemHeight = 96; // card height

function PrizeItem({ value }) {
  if (value === 'FREE_SPIN') {
    return (
      <>
        <img
          src="/assets/icons/file_00000000ae68620a96d269fe76d158e5_256x256.webp"
          alt="Free Spin"
          className="w-10 h-10"
        />
        <span className="font-bold text-white" style={{ WebkitTextStroke: '1px black' }}>+2</span>
      </>
    );
  }
  if (value === 'BONUS_X3') {
    return (
      <>
        <img
          src="/assets/icons/file_000000009160620a96f728f463de1c3f.webp"
          alt="Bonus"
          className="w-10 h-10"
        />
        <span className="font-bold text-white" style={{ WebkitTextStroke: '1px black' }}>X3</span>
      </>
    );
  }
  if (value === 'JOKER_BLACK') {
    return (
      <>
        <span className="text-3xl">🃏</span>
        <span className="font-bold text-black" style={{ WebkitTextStroke: '1px black' }}>5000</span>
      </>
    );
  }
  if (value === 'JOKER_RED') {
    return (
      <>
        <span className="text-3xl text-red-500">🃏</span>
        <span className="font-bold text-red-500" style={{ WebkitTextStroke: '1px black' }}>10000</span>
      </>
    );
  }
  return (
    <>
      <img
        src="/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp"
        alt="TonPlaygram"
        className="w-10 h-10"
      />
      <span className="font-bold text-white" style={{ WebkitTextStroke: '1px black' }}>{value}</span>
    </>
  );
}

export default function CardSpinner({ trigger = 0, onFinish }) {
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const spinSoundRef = useRef(null);

  useEffect(() => {
    spinSoundRef.current = new Audio('/assets/sounds/spinning.mp3');
    spinSoundRef.current.preload = 'auto';
    spinSoundRef.current.loop = true;
    spinSoundRef.current.volume = getGameVolume();
    const handler = () => {
      if (spinSoundRef.current) spinSoundRef.current.volume = getGameVolume();
    };
    window.addEventListener('gameVolumeChanged', handler);
    return () => {
      spinSoundRef.current?.pause();
      window.removeEventListener('gameVolumeChanged', handler);
    };
  }, []);

  useEffect(() => {
    if (!trigger) return;
    const base = [
      ...numericSegments,
      'FREE_SPIN',
      'BONUS_X3',
      'JOKER_BLACK',
      'JOKER_RED',
    ];
    const arr = [];
    for (let i = 0; i < 10; i++) {
      arr.push(base[Math.floor(Math.random() * base.length)]);
    }
    const finalReward = getLuckyReward();
    arr.push(finalReward);
    setItems(arr);
    setOffset(0);
    spinSoundRef.current?.play().catch(() => {});
    requestAnimationFrame(() => {
      setOffset(-((arr.length - 1) * itemHeight));
    });
    const timeout = setTimeout(() => {
      spinSoundRef.current?.pause();
      onFinish(finalReward);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [trigger, onFinish]);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-md bg-white">
      <div
        className="transition-transform duration-[4000ms] ease-out flex flex-col"
        style={{ transform: `translateY(${offset}px)` }}
      >
        {items.map((val, i) => (
          <div
            key={i}
            className="h-24 w-full flex flex-col items-center justify-center"
            style={{ height: `${itemHeight}px` }}
          >
            <PrizeItem value={val} />
          </div>
        ))}
      </div>
    </div>
  );
}

