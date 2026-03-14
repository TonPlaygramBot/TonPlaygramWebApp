import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OptionIcon from '../../components/OptionIcon.jsx';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

const OFFICIAL_STK_CODE_URL = 'https://github.com/supertuxkart/stk-code';

const TRACKS = [
  { id: 'grasslands', label: 'Grasslands', key: 'track-grasslands', fallback: '🌿' },
  { id: 'snowpeak', label: 'Snow Peak', key: 'track-snowpeak', fallback: '❄️' },
  { id: 'volcano', label: 'Volcano', key: 'track-volcano', fallback: '🌋' }
];

export default function GoKartLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();
  const [mode, setMode] = useState('solo');
  const [track, setTrack] = useState(TRACKS[0].id);

  const modeOptions = useMemo(
    () => [
      { id: 'solo', label: 'Solo Run', key: 'mode-solo', fallback: '🏁' },
      { id: 'online', label: 'Online Queue', key: 'mode-online', fallback: '🌍' }
    ],
    []
  );

  const openOfficialRepo = () => {
    window.open(OFFICIAL_STK_CODE_URL, '_blank', 'noopener,noreferrer');
  };

  const startLobbySession = () => {
    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('track', track);
    navigate(`/games/gokart?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] p-4 pb-8 text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4">
        <GameLobbyHeader slug="gokart" title="GoKart Lobby" badge="Open Source" />

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <p className="text-xs uppercase tracking-[0.28em] text-white/55">Official source</p>
          <p className="mt-2 leading-relaxed">
            GoKart uses the authentic SuperTuxKart open-source codebase.
          </p>
          <button
            type="button"
            onClick={openOfficialRepo}
            className="mt-3 inline-flex items-center rounded-xl border border-cyan-300/50 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/20"
          >
            Open official code → github.com/supertuxkart/stk-code
          </button>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold text-white">Mode</h3>
          <div className="grid grid-cols-2 gap-3">
            {modeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setMode(option.id)}
                className={`lobby-option-card ${
                  mode === option.id ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                }`}
              >
                <div className="lobby-option-thumb bg-gradient-to-br from-cyan-400/30 via-blue-500/15 to-transparent">
                  <div className="lobby-option-thumb-inner">
                    <OptionIcon
                      src={getLobbyIcon('gokart', option.key)}
                      alt={option.label}
                      fallback={option.fallback}
                      className="lobby-option-icon"
                    />
                  </div>
                </div>
                <p className="lobby-option-label">{option.label}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold text-white">Track</h3>
          <div className="grid grid-cols-3 gap-3">
            {TRACKS.map((option) => (
              <button
                key={option.id}
                onClick={() => setTrack(option.id)}
                className={`lobby-option-card ${
                  track === option.id ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                }`}
              >
                <div className="lobby-option-thumb bg-gradient-to-br from-emerald-400/30 via-green-500/10 to-transparent">
                  <div className="lobby-option-thumb-inner">
                    <OptionIcon
                      src={getLobbyIcon('gokart', option.key)}
                      alt={option.label}
                      fallback={option.fallback}
                      className="lobby-option-icon"
                    />
                  </div>
                </div>
                <p className="lobby-option-label">{option.label}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={startLobbySession}
          className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
        >
          Start GoKart Session
        </button>
      </div>
    </div>
  );
}
