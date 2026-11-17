import { useEffect, useMemo, useRef, useState } from 'react';
import SpinRewardVideo from './SpinRewardVideo.tsx';
import { getTelegramId } from '../utils/telegram.js';
import { rewardIdentity } from '../utils/rewardIdentity.js';
import useServerSpinReward from '../hooks/useServerSpinReward.js';
import coinConfetti from '../utils/coinConfetti';
import { getGameVolume } from '../utils/sound.js';

const ROULETTE_ORDER = [
  0,
  32,
  15,
  19,
  4,
  21,
  2,
  25,
  17,
  34,
  6,
  27,
  13,
  36,
  11,
  30,
  8,
  23,
  10,
  5,
  24,
  16,
  33,
  1,
  20,
  14,
  31,
  9,
  22,
  18,
  29,
  7,
  28,
  12,
  35,
  3,
  26,
];

const RED_NUMBERS = new Set([
  32,
  19,
  21,
  25,
  34,
  27,
  36,
  30,
  23,
  5,
  16,
  1,
  14,
  9,
  18,
  7,
  12,
  3,
]);

const SEGMENT_ANGLE = 360 / ROULETTE_ORDER.length;
const LABEL_OFFSET_ANGLE = -90 + SEGMENT_ANGLE / 2;
const WHEEL_ROTATION_OFFSET = 90;
const SPIN_DURATION_MS = 4500;

const formatCountdown = (ms) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
};

const formatPrize = (amount) =>
  amount.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

export default function RouletteMini({ reelUrl = null }) {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return null;
  }

  const [spinState, setSpinState] = useState({
    totalSpins: 0,
    rotation: WHEEL_ROTATION_OFFSET,
  });
  const [spinning, setSpinning] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const spinTimeoutRef = useRef(null);
  const spinSoundRef = useRef(null);
  const finishSpinRef = useRef(null);

  const wheelBackground = useMemo(() => {
    const parts = ROULETTE_ORDER.map((num, idx) => {
      const color =
        num === 0 ? '#16a34a' : RED_NUMBERS.has(num) ? '#dc2626' : '#111827';
      const start = idx * SEGMENT_ANGLE;
      const end = start + SEGMENT_ANGLE;
      return `${color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(from -90deg, ${parts.join(',')})`;
  }, []);

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

  useEffect(() => () => {
    if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
  }, []);

  const animationOwner = rewardIdentity();
  const finishSpin = () => {
    if (animationOwner !== rewardIdentity() || !finishSpinRef.current) return;
    const finish = finishSpinRef.current;
    finishSpinRef.current = null;
    clearTimeout(spinTimeoutRef.current);
    finish();
  };

  const startSpin = (grant) => {
    if (spinning || finishSpinRef.current) return;
    const index = ROULETTE_ORDER.indexOf(grant.outcome);
    if (index < 0) return;
    const extraSpins = Math.floor(Math.random() * 3) + 4;
    const totalSpins = spinState.totalSpins + extraSpins;
    const rotation =
      WHEEL_ROTATION_OFFSET -
      totalSpins * 360 -
      index * SEGMENT_ANGLE -
      SEGMENT_ANGLE / 2;

    setSpinning(true);
    setOutcome(null);

    setSpinState({ totalSpins, rotation });
    if (spinSoundRef.current) {
      spinSoundRef.current.currentTime = 0;
      spinSoundRef.current.play().catch(() => {});
    }

    finishSpinRef.current = () => {
      if (animationOwner !== rewardIdentity()) return;
      setSpinning(false);
      spinSoundRef.current?.pause();
      if (spinSoundRef.current) spinSoundRef.current.currentTime = 0;

      const resolvedNumber = ROULETTE_ORDER[index];
      const resolvedPrize = grant.amount;
      setOutcome({ number: resolvedNumber, prize: resolvedPrize });
      coinConfetti(36);
      const audio = new Audio(
        '/assets/sounds/11l-victory_sound_with_t-1749487412779-357604.mp3',
      );
      audio.volume = getGameVolume();
      audio.play().catch(() => {});

    };

    const completion = finishSpinRef.current;
    spinTimeoutRef.current = setTimeout(() => {
      if (finishSpinRef.current === completion) finishSpin();
    }, SPIN_DURATION_MS + 150);
  };

  const server = useServerSpinReward('roulette', startSpin);
  useEffect(() => {
    clearTimeout(spinTimeoutRef.current); spinTimeoutRef.current = null;
    finishSpinRef.current = null;
    spinSoundRef.current?.pause();
    if (spinSoundRef.current) spinSoundRef.current.currentTime = 0;
    setSpinning(false); setOutcome(null);
    setSpinState({ totalSpins: 0, rotation: WHEEL_ROTATION_OFFSET });
  }, [server.identity]);

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-4 text-center overflow-hidden wide-card">
      <img
        src="/assets/icons/roulette_bg.webp"
        alt=""
        className="absolute inset-0 w-full h-full object-cover -z-10 opacity-40"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <h3 className="text-lg font-bold text-white">Roulette Spin</h3>
      <SpinRewardVideo
        reelUrl={reelUrl}
        rewardOpen={server.showAd}
        onRewardComplete={server.claim}
        onRewardClose={server.closeAd}
      />
      <div className="relative mx-auto w-72 h-72 sm:w-80 sm:h-80">
        <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-20 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow" />
          <div className="w-2 h-2 bg-white rounded-full -mt-1 shadow ring-1 ring-gray-300" />
        </div>
        <div
          key={server.identity}
          className="relative w-full h-full rounded-full border-[3px] border-yellow-400/80 shadow-inner flex items-center justify-center overflow-hidden [--roulette-label-radius:132px] sm:[--roulette-label-radius:150px] will-change-transform"
          style={{
            background: wheelBackground,
            transform: `translateZ(0) rotate(${spinState.rotation}deg)`,
            transition: spinning
              ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : 'transform 0s',
          }}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && event.propertyName === 'transform') {
              finishSpin();
            }
          }}
        >
          <div className="absolute inset-[6%] rounded-full border-2 border-red-500/80 pointer-events-none" />
          {ROULETTE_ORDER.map((num, idx) => {
            const angle = idx * SEGMENT_ANGLE + LABEL_OFFSET_ANGLE;
            const isWinning = outcome?.number === num;
            return (
              <div
                key={num}
                className="absolute top-1/2 left-1/2"
                style={{
                  transform: `rotate(${angle}deg) translateY(calc(-1 * var(--roulette-label-radius)))`,
                  transformOrigin: '0 0',
                }}
              >
                <div
                  className={`px-1 py-[1px] text-[10px] sm:text-xs font-bold rounded-full ${
                    isWinning
                      ? 'bg-yellow-400 text-black shadow-lg'
                      : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]'
                  }`}
                  style={{
                    transform: `translate(-50%, -50%) rotate(${-angle}deg)`,
                  }}
                >
                  {num}
                </div>
              </div>
            );
          })}
        </div>
        <div className="absolute inset-[28%] rounded-full bg-surface/85 border border-yellow-400/80 flex flex-col items-center justify-center text-xs text-subtext space-y-1 pointer-events-none">
          <span className="uppercase tracking-wide">TPG Rewards</span>
          <span className="text-sm font-semibold text-white">
            {outcome ? `+${formatPrize(outcome.prize)} TPG` : 'Spin to win'}
          </span>
        </div>
        {outcome && !spinning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="roulette-prize-beam" />
            <div className="roulette-prize-pop">
              <div className="roulette-prize-value">
                +{formatPrize(outcome.prize)} TPG
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <button
          onClick={server.begin}
          disabled={!server.ready || server.busy || spinning}
          className={`px-6 py-2 rounded-full font-semibold transition text-white ${
            !server.ready || server.busy || spinning
              ? 'bg-border cursor-not-allowed'
              : 'bg-gradient-to-r from-brand-gold to-yellow-400 text-black shadow-lg'
          }`}
        >
          {spinning ? 'Spinning…' : server.busy ? 'Confirming…' : server.error ? 'Retry spin' : 'Spin the Wheel'}
        </button>
        {!server.ready && server.remaining > 0 && (
          <p className="text-sm text-subtext">
            Next spin available in {formatCountdown(server.remaining)}
          </p>
        )}
        {outcome && (
          <div className="text-sm text-white font-semibold">
            Winning Number {outcome.number} ·
            <span className="text-yellow-300 ml-1">
              +{formatPrize(outcome.prize)} TPG
            </span>
          </div>
        )}
      </div>
      {server.error && (
        <p role="status" className="text-sm text-yellow-300">
          Could not confirm the reward. Retry safely; the same spin will not be credited twice. {server.error}
        </p>
      )}
    </div>
  );
}
