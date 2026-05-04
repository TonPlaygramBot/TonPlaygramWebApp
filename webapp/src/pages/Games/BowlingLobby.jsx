import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getTelegramFirstName } from '../../utils/telegram.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';

export default function BowlingLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();
  const [mode, setMode] = useState('ai');
  const [playerFlag, setPlayerFlag] = useState('🇺🇸');
  const [playersCount, setPlayersCount] = useState(2);

  const avatarLabel = useMemo(() => `${playerFlag} ${getTelegramFirstName() || 'You'}`, [playerFlag]);

  const startGame = () => {
    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('players', String(playersCount));
    params.set('playerFlag', playerFlag);
    navigate(`/games/bowling?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader slug="bowling" title="Bowling Lobby" badge="2–8 players" description="Play vs AI or online with world-flag avatars." />
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4 text-white/80">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setPlayerFlag(FLAG_EMOJIS[(FLAG_EMOJIS.indexOf(playerFlag) + 1) % FLAG_EMOJIS.length] || '🇺🇸')} className="lobby-option-card lobby-option-card-inactive">
              <p className="lobby-option-label">{avatarLabel}</p>
              <p className="lobby-option-subtitle">Tap to cycle world-flag avatar</p>
            </button>
            <div className="lobby-option-card lobby-option-card-inactive">
              <p className="lobby-option-label">Players: {playersCount}</p>
              <p className="lobby-option-subtitle">Supports 2 to 8 players</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setMode('ai')} className={`lobby-option-card ${mode === 'ai' ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}>
              <p className="lobby-option-label">Vs AI</p>
              <p className="lobby-option-subtitle">Quick local match</p>
            </button>
            <button type="button" onClick={() => setMode('online')} className={`lobby-option-card ${mode === 'online' ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}>
              <p className="lobby-option-label">Online</p>
              <p className="lobby-option-subtitle">Multiplayer room</p>
            </button>
          </div>

          <div className="mt-3">
            <label className="text-xs uppercase text-white/60">Number of players</label>
            <input type="range" min={2} max={8} step={1} value={playersCount} onChange={(e) => setPlayersCount(Number(e.target.value) || 2)} className="mt-2 w-full" />
          </div>

          <button type="button" onClick={startGame} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-black">
            {mode === 'online' ? `Start Online (${playersCount} players)` : 'Start Vs AI'}
          </button>
        </div>
      </div>
    </div>
  );
}
