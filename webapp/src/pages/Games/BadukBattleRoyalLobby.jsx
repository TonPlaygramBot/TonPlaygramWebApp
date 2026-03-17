import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import { BADUK_BOARD_LAYOUTS } from '../../config/badukBattleInventoryConfig.js';
import { badukBattleAccountId, getBadukBattleInventory } from '../../utils/badukBattleInventory.js';

export default function BadukBattleRoyalLobby() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const [mode, setMode] = useState('ai');

  const inventory = useMemo(() => getBadukBattleInventory(badukBattleAccountId()), []);
  const ownedLayouts = inventory.boardLayout || [];
  const [boardLayout, setBoardLayout] = useState(ownedLayouts[0] || BADUK_BOARD_LAYOUTS[0]?.id);

  const startGame = () => {
    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('boardLayout', boardLayout);
    navigate(`/games/badukbattleroyal?${params.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader
          slug="badukbattleroyal"
          title="4 in a Row Lobby"
          subtitle="Same HDRI/table/chairs setup, redesigned as a vertical Connect-4 style battle board."
        />

        <section className="rounded-3xl border border-white/10 bg-black/25 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Match Mode</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { id: 'ai', label: 'AI / Local', desc: 'Play against a strong AI.' },
              { id: 'online', label: 'Online', desc: 'Lobby-ready multiplayer entry.' }
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
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Board Inventory</h2>
          <p className="mt-2 text-xs text-white/60">Default board is 7×6. Unlock 8×7 in the store to use it here.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {BADUK_BOARD_LAYOUTS.map((layout) => {
              const active = boardLayout === layout.id;
              const owned = ownedLayouts.includes(layout.id);
              return (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => {
                    if (owned) setBoardLayout(layout.id);
                    else navigate('/store/badukbattleroyal');
                  }}
                  className={`lobby-option-card ${active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'} ${!owned ? 'opacity-70' : ''}`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-amber-400/35 via-orange-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('badukbattleroyal', `layout-${layout.id}`)}
                        fallback="🧩"
                        alt={layout.label}
                        className="lobby-option-icon"
                      />
                    </div>
                  </div>
                  <p className="lobby-option-label">{layout.label}</p>
                  <p className="lobby-option-subtitle">{owned ? 'Owned' : 'Locked • Tap to open store'}</p>
                </button>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          onClick={startGame}
          className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/25"
        >
          Start 4 in a Row
        </button>
      </div>
    </div>
  );
}
