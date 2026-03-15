import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';
import { GOKART_TRACKS } from './gokart/trackConfig.js';

const MODES = [
  { id: 'solo', label: 'Solo Race', icon: '🏁', helper: 'Clean onboarding and instant play.' },
  { id: 'time-attack', label: 'Time Attack', icon: '⏱️', helper: 'Focus on precision and pace.' }
];

export default function GoKartLobby() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const [mode, setMode] = useState(MODES[0].id);
  const [trackId, setTrackId] = useState(GOKART_TRACKS[0].id);

  const selectedTrack = useMemo(
    () => GOKART_TRACKS.find((entry) => entry.id === trackId) || GOKART_TRACKS[0],
    [trackId]
  );

  const startRace = () => {
    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('track', selectedTrack.id);
    params.set('laps', String(selectedTrack.laps));
    navigate(`/games/gokart?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#060b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-50" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader slug="gokart" title="GoKart Lobby" badge="Open Source" />

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-white">Mode</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                className={`lobby-option-card ${mode === option.id ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}
              >
                <OptionIcon
                  src={getLobbyIcon('gokart', `mode-${option.id}`)}
                  fallback={option.icon}
                  alt={option.label}
                  className="lobby-option-thumb"
                />
                <div className="mt-2 text-xs font-semibold text-white">{option.label}</div>
                <p className="mt-1 text-[10px] text-white/60">{option.helper}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-white">Track</h3>
          <div className="mt-3 space-y-2">
            {GOKART_TRACKS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTrackId(entry.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  trackId === entry.id
                    ? 'border-cyan-300/80 bg-cyan-400/20 text-cyan-100'
                    : 'border-white/10 bg-black/20 text-white/80 hover:border-white/30'
                }`}
              >
                <div className="font-semibold">{entry.label}</div>
                <div className="text-xs text-white/60">{entry.laps} laps · {entry.description}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
          Controls: use <strong>↑ / ↓</strong> (or <strong>W / S</strong>) to keep the kart stable through each lap.
        </section>

        <button
          type="button"
          onClick={startRace}
          className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-lg"
        >
          Start GoKart Race
        </button>
      </div>
    </div>
  );
}
