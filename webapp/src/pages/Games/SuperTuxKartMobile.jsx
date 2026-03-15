import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

const TRACK_LOOKUP = {
  lighthouse: 'Lighthouse',
  snowtuxpeak: 'SnowTux Peak',
  candela_city: 'Candela City',
  gran_paradiso: 'Gran Paradiso Island',
  xr591: 'XR591',
  zen_garden: 'Zen Garden'
};

export default function SuperTuxKartMobile() {
  useTelegramBackButton('/games/supertuxkart/lobby');
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const mode = params.get('mode') || 'ai';
  const players = Number(params.get('players') || 4);
  const laps = Number(params.get('laps') || 3);
  const track = params.get('track') || 'lighthouse';

  const modeLabel = mode === 'online' ? 'Online race queue' : 'Vs AI race';
  const trackName = TRACK_LOOKUP[track] || 'Lighthouse';

  return (
    <div className="relative min-h-screen bg-[#060a14] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(6,10,20,0.95)_55%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col p-4 pb-6">
        <header className="rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur">
          <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-200/80">SuperTuxKart Mobile</p>
          <h1 className="mt-1 text-xl font-bold">{trackName}</h1>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-white/60">Mode</p>
              <p className="mt-1 font-semibold">{modeLabel}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-white/60">Players</p>
              <p className="mt-1 font-semibold">{players}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-white/60">Laps</p>
              <p className="mt-1 font-semibold">{laps}</p>
            </div>
          </div>
        </header>

        <main className="mt-4 flex-1 rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-black/70 p-4">
          <div className="relative h-full min-h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#86efac_0%,#166534_35%,#064e3b_100%)] p-4">
            <div className="absolute left-4 right-4 top-3 flex items-center justify-between text-xs font-semibold text-black/75">
              <span>🏁 {trackName}</span>
              <span>Lap 1 / {laps}</span>
            </div>
            <div className="absolute inset-x-0 top-20 mx-auto h-16 w-11/12 rounded-full border-4 border-dashed border-white/50" />
            <div className="absolute left-1/2 top-40 h-24 w-24 -translate-x-1/2 rounded-full border-4 border-black/50 bg-emerald-200/40" />
            <div className="absolute left-1/2 top-1/2 h-10 w-16 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-black/40 bg-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.55)]" />
            <p className="absolute bottom-3 left-3 right-3 rounded-xl border border-black/20 bg-black/35 px-3 py-2 text-center text-xs text-emerald-50/90">
              Mobile adaptation shell: touch steering + acceleration UI is ready for integrating the full STK rendering core.
            </p>
          </div>
        </main>

        <footer className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/35 p-3">
          <button type="button" className="rounded-xl border border-white/20 bg-white/10 py-2 text-sm">⟲ Brake</button>
          <button type="button" className="rounded-xl border border-white/20 bg-white/10 py-2 text-sm">⬅️ Steer</button>
          <button type="button" className="rounded-xl border border-emerald-300/50 bg-emerald-400/25 py-2 text-sm font-semibold">⚡ Boost</button>
          <button type="button" className="col-span-3 rounded-xl border border-cyan-300/45 bg-cyan-400/25 py-2 text-sm font-semibold">⬆️ Hold to Accelerate</button>
        </footer>

        <Link
          to="/games/supertuxkart/lobby"
          className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/70"
        >
          Back to lobby
        </Link>
      </div>
    </div>
  );
}
