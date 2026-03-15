import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import OptionIcon from '../../components/OptionIcon.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getLobbyIcon } from '../../config/gameAssets.js';

const TRACKS = [
  { id: 'lighthouse', name: 'Lighthouse', icon: '🌊' },
  { id: 'snowtuxpeak', name: 'SnowTux Peak', icon: '🏔️' },
  { id: 'candela_city', name: 'Candela City', icon: '🌃' },
  { id: 'gran_paradiso', name: 'Gran Paradiso Island', icon: '🏝️' },
  { id: 'xr591', name: 'XR591', icon: '🚀' },
  { id: 'zen_garden', name: 'Zen Garden', icon: '🎋' }
];

export default function SuperTuxKartLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [mode, setMode] = useState('ai');
  const [players, setPlayers] = useState(4);
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [laps, setLaps] = useState(3);

  const selectedTrack = useMemo(
    () => TRACKS.find((track) => track.id === trackId) || TRACKS[0],
    [trackId],
  );

  const startRace = () => {
    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('players', String(players));
    params.set('track', selectedTrack.id);
    params.set('laps', String(laps));
    params.set('source', 'supertuxkart-open-source');
    navigate(`/games/supertuxkart?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#080b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-55" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader slug="supertuxkart" title="SuperTuxKart Lobby" badge="Mobile tuned" />

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101928]/80 to-[#0b1324]/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Open-source source</p>
          <p className="mt-2 text-sm text-white/80">
            Based on the original SuperTuxKart project and adapted for quick portrait mobile sessions.
          </p>
          <a
            href="https://github.com/supertuxkart/stk-code"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200"
          >
            View original open-source code
          </a>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Mode</h3>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'ai', label: 'Vs AI', icon: '🤖' },
                { id: 'online', label: 'Online', icon: '🌐' },
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`lobby-option-card ${mode === id ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-orange-400/30 via-yellow-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('supertuxkart', `mode-${id}`)}
                        alt={label}
                        fallback={icon}
                        className="lobby-option-icon"
                      />
                    </div>
                  </div>
                  <p className="lobby-option-label">{label}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold text-white">Players</h3>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid grid-cols-3 gap-3">
              {[2, 4, 8].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setPlayers(count)}
                  className={`lobby-option-card ${players === count ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-sky-400/30 via-cyan-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner text-xl">🏁</div>
                  </div>
                  <p className="lobby-option-label">{count} Racers</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold text-white">Track</h3>
          <div className="grid grid-cols-2 gap-3">
            {TRACKS.map((track) => (
              <button
                key={track.id}
                type="button"
                onClick={() => setTrackId(track.id)}
                className={`rounded-2xl border p-3 text-left transition ${
                  trackId === track.id
                    ? 'border-emerald-300/60 bg-emerald-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/30'
                }`}
              >
                <div className="text-lg">{track.icon}</div>
                <p className="mt-2 text-sm font-semibold text-white">{track.name}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">Laps</span>
            <span className="text-sm font-semibold text-white">{laps}</span>
          </div>
          <input
            type="range"
            min={1}
            max={7}
            value={laps}
            onChange={(event) => setLaps(Number(event.target.value))}
            className="mt-3 w-full accent-emerald-400"
          />
        </section>

        <button
          type="button"
          onClick={startRace}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-bold uppercase tracking-wide text-black"
        >
          Start SuperTuxKart Mobile
        </button>
      </div>
    </div>
  );
}
