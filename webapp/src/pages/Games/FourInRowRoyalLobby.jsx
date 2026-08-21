import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import { FOUR_IN_ROW_BOARD_LAYOUTS } from '../../config/fourInRowInventoryConfig.js';
import { fourInRowAccountId, getFourInRowInventory } from '../../utils/fourInRowInventory.js';
import RoomSelector from '../../components/RoomSelector.jsx';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';
import { ensureAccountId, getTelegramFirstName, getTelegramId } from '../../utils/telegram.js';
import { getAccountBalance } from '../../utils/api.js';
import { socket } from '../../utils/socket.js';

const HOST_PREFIX = 'fourinrow-2-host';
const normalizeHostCode = (value = '') => String(value).trim().replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 48);

export default function FourInRowRoyalLobby() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const [mode, setMode] = useState('ai');
  const [stake, setStake] = useState({ token: 'TPG', amount: 100 });
  const [matching, setMatching] = useState(false);
  const [matchStatus, setMatchStatus] = useState('');
  const [matchError, setMatchError] = useState('');
  const [onlineQueueMode, setOnlineQueueMode] = useState('quick');
  const [hostCode, setHostCode] = useState('');
  const [matchPlayers, setMatchPlayers] = useState([]);
  const cleanupRef = useRef(null);

  const inventory = useMemo(() => getFourInRowInventory(fourInRowAccountId()), []);
  const ownedLayouts = inventory.boardLayout || [];
  const [boardLayout, setBoardLayout] = useState(ownedLayouts[0] || FOUR_IN_ROW_BOARD_LAYOUTS[0]?.id);

  useEffect(() => () => cleanupRef.current?.({ refund: true }), []);

  const navigateToGame = ({ tableId = '', accountId = '' } = {}) => {
    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('boardLayout', boardLayout);
    if (tableId) params.set('tableId', tableId);
    if (accountId) params.set('accountId', accountId);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', String(stake.amount));
    navigate(`/games/fourinrowroyale?${params.toString()}`);
  };

  const startGame = async () => {
    if (mode !== 'online') {
      navigateToGame();
      return;
    }
    const layout = FOUR_IN_ROW_BOARD_LAYOUTS.find((item) => item.id === boardLayout);
    const privateTableId = onlineQueueMode === 'private' && hostCode
      ? `${HOST_PREFIX}-${normalizeHostCode(hostCode)}`
      : '';
    if (onlineQueueMode === 'private' && !privateTableId) {
      setMatchError('Enter a private code to create or join a 4 in a Row table.');
      return;
    }
    await runSimpleOnlineFlow({
      gameType: 'fourinrow',
      stake,
      maxPlayers: 2,
      playerName: getTelegramFirstName() || 'Player',
      matchMeta: { boardSize: `${layout?.cols || 7}x${layout?.rows || 6}` },
      tableId: privateTableId,
      quickMatch: onlineQueueMode === 'quick',
      state: {
        setMatching,
        setMatchStatus,
        setMatchError,
        setMatchPlayers,
        setCleanup: (cleanup) => { cleanupRef.current = cleanup; }
      },
      deps: { ensureAccountId, getAccountBalance, getTelegramId, socket },
      onMatched: ({ tableId, accountId }) => navigateToGame({ tableId, accountId })
    });
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-28">
        <GameLobbyHeader
          slug="fourinrowroyale"
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
                        src={getLobbyIcon('fourinrowroyale', `mode-${item.id}`)}
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

        {mode === 'online' && (
          <section className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <RoomSelector selected={stake} onSelect={setStake} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {['quick', 'private'].map((queue) => (
                <button
                  key={queue}
                  type="button"
                  onClick={() => setOnlineQueueMode(queue)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${onlineQueueMode === queue ? 'border-cyan-300 bg-cyan-300/15 text-cyan-200' : 'border-white/10 bg-white/5 text-white/60'}`}
                >
                  {queue === 'quick' ? 'Quick Match' : 'Private Code'}
                </button>
              ))}
            </div>
            {onlineQueueMode === 'private' && (
              <input
                value={hostCode}
                onChange={(event) => setHostCode(normalizeHostCode(event.target.value))}
                placeholder="FRIEND123"
                aria-label="Private table code"
                className="mt-3 w-full rounded-xl border border-white/10 bg-[#050914] px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
              />
            )}
            {(matchStatus || matchError) && (
              <p className={`mt-3 text-center text-sm ${matchError ? 'text-rose-300' : 'text-cyan-200'}`}>
                {matchError || matchStatus}
              </p>
            )}
            {matching && matchPlayers.map((player) => (
              <div key={player.tpcAccountNumber || player.id} className="lobby-tile mt-2 flex items-center justify-between">
                <span>{player.name || 'Player'}</span><span className="text-xs text-cyan-200">Seated</span>
              </div>
            ))}
            {matching && (
              <button type="button" onClick={() => cleanupRef.current?.()} className="mt-3 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80">
                Cancel matchmaking
              </button>
            )}
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-black/25 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Board Inventory</h2>
          <p className="mt-2 text-xs text-white/60">Default board is 7×6. Unlock 8×7 in the store to use it here.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {FOUR_IN_ROW_BOARD_LAYOUTS.map((layout) => {
              const active = boardLayout === layout.id;
              const owned = ownedLayouts.includes(layout.id);
              return (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => {
                    if (owned) setBoardLayout(layout.id);
                    else navigate('/store/fourinrowroyale');
                  }}
                  className={`lobby-option-card ${active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'} ${!owned ? 'opacity-70' : ''}`}
                >
                  <div className="lobby-option-thumb bg-gradient-to-br from-amber-400/35 via-orange-500/10 to-transparent">
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('fourinrowroyale', `layout-${layout.id}`)}
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
          disabled={matching}
          className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/25"
        >
          {matching ? 'Searching for Test opponent…' : 'Start 4 in a Row'}
        </button>
      </div>
    </div>
  );
}
