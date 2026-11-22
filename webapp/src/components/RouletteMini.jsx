import SpinRewardVideo from './SpinRewardVideo.tsx';
import { getTelegramId } from '../utils/telegram.js';

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
const wheelBackground = `conic-gradient(from -90deg, ${ROULETTE_ORDER.map((num, idx) => {
  const color = num === 0 ? '#16a34a' : RED_NUMBERS.has(num) ? '#dc2626' : '#111827';
  return `${color} ${idx * SEGMENT_ANGLE}deg ${(idx + 1) * SEGMENT_ANGLE}deg`;
}).join(', ')})`;

export default function RouletteMini({ reelUrl = null }) {
  try {
    getTelegramId();
  } catch {
    return null;
  }

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
      <SpinRewardVideo reelUrl={reelUrl} />
      <p className="text-sm text-subtext">Reel-based roulette rewards are paused.</p>
      <div aria-hidden="true" className="relative mx-auto w-72 h-72 sm:w-80 sm:h-80">
        <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-20 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow" />
          <div className="w-2 h-2 bg-white rounded-full -mt-1 shadow ring-1 ring-gray-300" />
        </div>
        <div
          className="relative w-full h-full rounded-full border-[3px] border-yellow-400/80 shadow-inner flex items-center justify-center overflow-hidden [--roulette-label-radius:132px] sm:[--roulette-label-radius:150px] will-change-transform"
          style={{ background: wheelBackground, transform: `rotate(${WHEEL_ROTATION_OFFSET}deg)` }}
        >
          <div className="absolute inset-[6%] rounded-full border-2 border-red-500/80 pointer-events-none" />
          {ROULETTE_ORDER.map((num, idx) => {
            const angle = idx * SEGMENT_ANGLE + LABEL_OFFSET_ANGLE;
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
                  className="px-1 py-[1px] text-[10px] sm:text-xs font-bold rounded-full text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
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
            Rewards paused
          </span>
        </div>
      </div>
    </div>
  );
}
