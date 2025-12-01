import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import DominoRoyalArena from './DominoRoyalArena.jsx';

export default function DominoRoyal() {
  useTelegramBackButton();
  return (
    <div className="relative w-full h-screen bg-slate-900 text-white">
      <DominoRoyalArena />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-900/40 via-transparent to-black/60" />
      <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 flex-col items-center gap-2 px-4 text-center drop-shadow-lg">
        <p className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
          Domino Battle Royale — Last Tile Standing
        </p>
        <p className="max-w-2xl text-xs text-slate-200">
          Orbit to scout the arena, pinch to zoom, and tap the boosts to unleash shockwaves.
          Keep dominoes upright inside the ring; falling below the rim eliminates them.
        </p>
      </div>
    </div>
  );
}
