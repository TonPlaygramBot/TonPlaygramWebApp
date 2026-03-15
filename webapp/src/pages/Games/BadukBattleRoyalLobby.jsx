import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';

const BOARD_SIZES = [9, 13, 16, 19];

export default function BadukBattleRoyalLobby() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const [mode, setMode] = useState('ai');
  const [boardSize, setBoardSize] = useState(19);

  const startGame = () => {
    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('boardSize', String(boardSize));
    navigate(`/games/badukbattleroyal?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader
          slug="badukbattleroyal"
          title="Baduk Battle Royal Lobby"
          subtitle="Same Chess/Checkers Battle Royal arena assets, now with a full Baduk board and rules."
        />

        <section className="rounded-3xl border border-white/10 bg-black/25 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Match Mode</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { id: 'ai', label: 'AI / Local', desc: 'Fast onboarding and practice.' },
              { id: 'online', label: 'Online', desc: 'Lobby-ready flow for multiplayer start.' }
            ].map((item) => {
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`lobby-option-card ${active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-cyan-400/30 via-indigo-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('badukbattleroyal', `mode-${item.id}`)}
                        fallback={item.id === 'ai' ? '🤖' : '🌐'}
                        alt={item.label}
                        className="lobby-option-icon"
                      />
                    </div>
                  </div>
                  <p className="lobby-option-label">{item.label}</p>
                  <p className="lobby-option-subtitle">{item.desc}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/25 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Board Size</h2>
          <p className="mt-2 text-xs text-white/60">Choose the standard Baduk board sizes (including 16x16 quick format).</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {BOARD_SIZES.map((size) => {
              const active = boardSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setBoardSize(size)}
                  className={`lobby-option-card ${active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'}`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-amber-400/35 via-orange-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('badukbattleroyal', `size-${size}`)}
                        fallback="🧩"
                        alt={`${size} board`}
                        className="lobby-option-icon"
                      />
                    </div>
                  </div>
                  <p className="lobby-option-label">{size} × {size}</p>
                  <p className="lobby-option-subtitle">Grid strategy and capture rules enabled.</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/25 p-4 text-xs text-white/70">
          <h3 className="text-sm font-semibold text-white">Rules enabled</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Alternate turns (Black starts first).</li>
            <li>Capture groups with zero liberties.</li>
            <li>Suicide moves are blocked.</li>
            <li>Two consecutive passes end the game.</li>
          </ul>
        </section>

        <button
          type="button"
          onClick={startGame}
          className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/25"
        >
          Start Baduk Battle Royal
        </button>
      </div>
    </div>
  );
}
