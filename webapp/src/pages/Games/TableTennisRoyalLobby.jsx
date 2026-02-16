import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getTelegramFirstName, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';

export default function TableTennisRoyalLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();
  const [avatar, setAvatar] = useState('');
  const [mode, setMode] = useState('ai');
  const [graphics, setGraphics] = useState('high');
  const [fps, setFps] = useState('fhd90');

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {
      setAvatar(getTelegramPhotoUrl());
    }
  }, []);

  const startGame = () => {
    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('graphics', graphics);
    params.set('fps', fps);
    navigate(`/games/tabletennisroyal?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader slug="tabletennisroyal" title="Table Tennis Royal Lobby" badge="New" />

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Player Profile</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/5">
              {avatar ? <img src={avatar} alt="Your avatar" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="text-sm text-white/80">
              <p className="font-semibold">{getTelegramFirstName() || 'Player'} ready</p>
              <p className="text-xs text-white/50">Table Tennis Royal</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Mode</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Queue</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { id: 'ai', label: 'Vs AI', icon: '🤖' },
              { id: 'online', label: '1v1 Online', icon: '🌐', disabled: true }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => !item.disabled && setMode(item.id)}
                className={`lobby-option-card ${mode === item.id ? 'lobby-option-card-active' : 'lobby-option-card-inactive'} ${item.disabled ? 'lobby-option-card-disabled' : ''}`}
                disabled={item.disabled}
              >
                <div className="lobby-option-thumb bg-gradient-to-br from-sky-400/30 via-indigo-500/10 to-transparent">
                  <div className="lobby-option-thumb-inner">
                    <OptionIcon src={getLobbyIcon('tabletennisroyal', `mode-${item.id}`)} alt={item.label} fallback={item.icon} className="lobby-option-icon" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="lobby-option-label">{item.label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">FPS profile</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Frame rate</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3">
            {[
              { id: 'hd50', label: 'HD Performance (50 Hz)' },
              { id: 'fhd90', label: 'Full HD (90 Hz)' },
              { id: 'qhd105', label: 'Quad HD (105 Hz)' },
              { id: 'uhd120', label: 'Ultra HD (120 Hz cap)' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFps(item.id)}
                className={`lobby-option-card ${fps === item.id ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}
              >
                <p className="lobby-option-label">{item.label}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Graphics</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Quality</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {['low', 'medium', 'high'].map((id) => (
              <button
                key={id}
                onClick={() => setGraphics(id)}
                className={`lobby-option-card ${graphics === id ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}
              >
                <p className="lobby-option-label capitalize">{id}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={startGame}
          className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg"
        >
          Start Table Tennis Royal
        </button>
      </div>
    </div>
  );
}
