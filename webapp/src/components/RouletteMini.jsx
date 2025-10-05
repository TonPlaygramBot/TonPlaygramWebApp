import { useEffect, useMemo, useRef, useState } from 'react';
import AdModal from './AdModal.tsx';
import { getTelegramId } from '../utils/telegram.js';
import { getWalletBalance, updateBalance, addTransaction } from '../utils/api.js';
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

const PRIZE_MAP = ROULETTE_ORDER.reduce((acc, value) => {
  if (value === 0) acc[value] = 5000;
  else acc[value] = value * 100;
  return acc;
}, {});

const COOLDOWN = 4 * 60 * 60 * 1000; // 4 hours

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

export default function RouletteMini() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return null;
  }

  const [spinState, setSpinState] = useState({ totalSpins: 0, rotation: 0 });
  const [spinning, setSpinning] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [showAd, setShowAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [canSpin, setCanSpin] = useState(false);
  const [nextSpinTime, setNextSpinTime] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const spinTimeoutRef = useRef(null);

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
    const lastSpin = parseInt(localStorage.getItem('rouletteSpinTs') || '0', 10);
    if (!lastSpin) {
      setCanSpin(true);
      setNextSpinTime(null);
      return;
    }
    const elapsed = Date.now() - lastSpin;
    if (elapsed >= COOLDOWN) {
      setCanSpin(true);
      setNextSpinTime(null);
    } else {
      setCanSpin(false);
      setNextSpinTime(lastSpin + COOLDOWN);
      setRemaining(COOLDOWN - elapsed);
    }
  }, []);

  useEffect(() => {
    if (!nextSpinTime) {
      setRemaining(0);
      return;
    }
    setCanSpin(false);
    const update = () => {
      const diff = nextSpinTime - Date.now();
      if (diff <= 0) {
        setNextSpinTime(null);
        setCanSpin(true);
        setRemaining(0);
      } else {
        setRemaining(diff);
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextSpinTime]);

  useEffect(() => () => {
    if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
  }, []);

  const startSpin = () => {
    if (spinning) return;
    const index = Math.floor(Math.random() * ROULETTE_ORDER.length);
    const number = ROULETTE_ORDER[index];
    const prize = PRIZE_MAP[number];
    const extraSpins = Math.floor(Math.random() * 3) + 4;

    setSpinning(true);
    setOutcome(null);
    setAdWatched(false);
    setSpinState((prev) => {
      const totalSpins = prev.totalSpins + extraSpins;
      const rotation =
        -totalSpins * 360 - index * SEGMENT_ANGLE - SEGMENT_ANGLE / 2;
      return { totalSpins, rotation };
    });

    const timeout = setTimeout(async () => {
      setSpinning(false);
      setOutcome({ number, prize });
      const now = Date.now();
      localStorage.setItem('rouletteSpinTs', String(now));
      const next = now + COOLDOWN;
      setNextSpinTime(next);
      setCanSpin(false);

      try {
        const balRes = await getWalletBalance(telegramId);
        const newBalance = (balRes.balance || 0) + prize;
        await updateBalance(telegramId, newBalance);
        await addTransaction(telegramId, prize, 'roulette');
      } catch (err) {
        // ignore API errors silently
      }

      coinConfetti(60, '/assets/icons/ezgif-54c96d8a9b9236.webp');
      const audio = new Audio(
        '/assets/sounds/11l-victory_sound_with_t-1749487412779-357604.mp3',
      );
      audio.volume = getGameVolume();
      audio.play().catch(() => {});
    }, 4500);

    spinTimeoutRef.current = timeout;
  };

  const handleSpinClick = () => {
    if (!canSpin || spinning) return;
    if (!adWatched) {
      setShowAd(true);
      return;
    }
    startSpin();
  };

  const handleAdComplete = () => {
    setAdWatched(true);
    setShowAd(false);
    startSpin();
  };

  const handleAdClose = () => {
    setShowAd(false);
  };

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
      <div
        className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72"
        style={{ perspective: '1100px' }}
      >
        <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-20 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[18px] border-l-transparent border-r-transparent border-b-yellow-400 drop-shadow" />
          <div className="w-2 h-2 bg-yellow-400 rounded-full mt-1" />
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: 'rotateX(14deg)', transformStyle: 'preserve-3d' }}
        >
          <div
            className="relative w-full h-full rounded-full border-[10px] border-[#272c3a] shadow-[inset_0_18px_28px_rgba(255,255,255,0.08),inset_0_-20px_32px_rgba(0,0,0,0.45),0_18px_30px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-hidden bg-[#111827]"
            style={{
              background: wheelBackground,
              transform: `rotate(${spinState.rotation}deg)`,
              transition: spinning
                ? 'transform 4.5s cubic-bezier(0.22, 1, 0.36, 1)'
                : 'transform 0s',
              boxShadow:
                'inset 0 18px 28px rgba(255,255,255,0.08), inset 0 -20px 32px rgba(0,0,0,0.45), 0 18px 30px rgba(0,0,0,0.6)',
            }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-[6%] rounded-full border-[8px] border-[#0f172a] shadow-[inset_0_6px_12px_rgba(0,0,0,0.5)]" />
              <div className="absolute inset-[10%] rounded-full border border-white/10" />
              <div className="absolute inset-[2%] rounded-full border border-white/10 opacity-60" />
            </div>
            {ROULETTE_ORDER.map((num, idx) => {
              const angle = idx * SEGMENT_ANGLE;
              const isWinning = outcome?.number === num;
              return (
                <div
                  key={num}
                  className="absolute top-1/2 left-1/2"
                  style={{
                    transform: `rotate(${angle}deg) translateY(-44%)`,
                    transformOrigin: '0 0',
                  }}
                >
                  <div
                    className={`flex flex-col items-center text-[10px] sm:text-xs font-semibold px-1 py-[2px] rounded-md backdrop-blur-[1px] ${
                      isWinning
                        ? 'bg-yellow-400 text-black shadow-lg'
                        : 'bg-black/35 text-white'
                    }`}
                    style={{ transform: `rotate(${-angle}deg)` }}
                  >
                    <span className="text-sm sm:text-base font-bold leading-none">
                      {num}
                    </span>
                    <span className="text-[9px] sm:text-[11px] leading-tight">
                      +{formatPrize(PRIZE_MAP[num])} TPC
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="absolute inset-0 pointer-events-none">
              {ROULETTE_ORDER.map((num, idx) => {
                const angle = idx * SEGMENT_ANGLE;
                const isWinning = outcome?.number === num;
                return (
                  <span
                    key={`rim-${num}`}
                    className={`absolute text-[11px] sm:text-sm font-bold tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${
                      isWinning ? 'text-yellow-300' : 'text-white'
                    }`}
                    style={{
                      transform: `rotate(${angle}deg) translateY(-49%) rotate(${-angle}deg)`,
                      transformOrigin: '0 0',
                    }}
                  >
                    {num}
                  </span>
                );
              })}
            </div>
            <div className="absolute inset-[28%] rounded-full bg-surface/80 border border-border flex items-center justify-center text-xs text-subtext">
              <span className="uppercase tracking-wide">TPC Rewards</span>
            </div>
            <div className="absolute inset-[20%] rounded-full pointer-events-none shadow-[0_12px_18px_rgba(0,0,0,0.35),inset_0_8px_16px_rgba(255,255,255,0.04)]" />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <button
          onClick={handleSpinClick}
          disabled={!canSpin || spinning}
          className={`px-6 py-2 rounded-full font-semibold transition text-white ${
            !canSpin || spinning
              ? 'bg-border cursor-not-allowed'
              : 'bg-gradient-to-r from-brand-gold to-yellow-400 text-black shadow-lg'
          }`}
        >
          {spinning ? 'Spinning…' : 'Spin the Wheel'}
        </button>
        {!canSpin && remaining > 0 && (
          <p className="text-sm text-subtext">
            Next spin available in {formatCountdown(remaining)}
          </p>
        )}
        {outcome && (
          <div className="text-sm text-white font-semibold">
            Winning Number {outcome.number} ·
            <span className="text-yellow-300 ml-1">
              +{formatPrize(outcome.prize)} TPC
            </span>
          </div>
        )}
      </div>
      <AdModal open={showAd} onComplete={handleAdComplete} onClose={handleAdClose} />
    </div>
  );
}
