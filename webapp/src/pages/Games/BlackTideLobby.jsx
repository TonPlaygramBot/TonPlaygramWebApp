import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getAccountBalance } from '../../utils/api.js';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';
import { socket } from '../../utils/socket.js';
import { ensureAccountId, getTelegramFirstName, getTelegramId } from '../../utils/telegram.js';

const normalizeCode = (value = '') => String(value).replace(/[^a-z0-9_-]/gi, '').toUpperCase().slice(0, 20);

export default function BlackTideLobby() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const cleanupRef = useRef(null);
  const [mode, setMode] = useState('online');
  const [stake, setStake] = useState({ token: 'TPG', amount: 100 });
  const [queueMode, setQueueMode] = useState('quick');
  const [privateCode, setPrivateCode] = useState('');
  const [matching, setMatching] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [players, setPlayers] = useState([]);

  useEffect(() => () => cleanupRef.current?.(), []);

  const openGame = ({ tableId = '', accountId = '' } = {}) => {
    const params = new URLSearchParams({ mode, token: stake.token, amount: String(stake.amount) });
    if (tableId) params.set('tableId', tableId);
    if (accountId) params.set('accountId', accountId);
    window.location.assign(`/games/black-tide/?${params}`);
  };

  const start = async () => {
    if (mode === 'solo') return openGame();
    const tableId = queueMode === 'private' && privateCode ? `black-tide-2-host-${normalizeCode(privateCode)}` : '';
    if (queueMode === 'private' && !tableId) return setError('Enter a private room code first.');
    await runSimpleOnlineFlow({
      gameType: 'black-tide', stake, maxPlayers: 2,
      playerName: getTelegramFirstName() || 'Player', tableId,
      quickMatch: queueMode === 'quick',
      matchMeta: { format: 'co-op-campaign', campaign: 'black-tide' },
      state: { setMatching, setMatchStatus: setStatus, setMatchError: setError, setMatchPlayers: setPlayers,
        setCleanup: (cleanup) => { cleanupRef.current = cleanup; } },
      deps: { ensureAccountId, getAccountBalance, getTelegramId, socket },
      onMatched: openGame
    });
  };

  return <main className="relative min-h-screen overflow-hidden bg-[#02050a] px-4 pb-28 pt-4 text-white">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,.22),transparent_48%)]" />
    <div className="relative mx-auto max-w-lg space-y-4">
      <GameLobbyHeader slug="black-tide" title="Black Tide Lobby" subtitle="Enter the same rain-soaked city with a matched ally." />
      <section className="grid grid-cols-2 gap-3 rounded-3xl border border-white/10 bg-white/[0.06] p-4">
        {[['online', 'Online Co-op', 'Match with one ally.'], ['solo', 'Solo Campaign', 'Continue alone.']].map(([id, title, text]) =>
          <button key={id} type="button" onClick={() => setMode(id)} className={`rounded-2xl border p-4 text-left ${mode === id ? 'border-cyan-300 bg-cyan-300/15' : 'border-white/10 bg-black/20'}`}>
            <span className="text-2xl">{id === 'online' ? '⚔️' : '🎯'}</span><strong className="mt-3 block text-sm">{title}</strong><span className="mt-1 block text-xs text-white/55">{text}</span>
          </button>)}
      </section>
      {mode === 'online' && <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
        <RoomSelector selected={stake} onSelect={setStake} />
        <div className="mt-4 grid grid-cols-2 gap-2">{['quick', 'private'].map((value) => <button key={value} type="button" onClick={() => setQueueMode(value)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${queueMode === value ? 'border-cyan-300 bg-cyan-300/15' : 'border-white/10 text-white/60'}`}>{value === 'quick' ? 'Quick Match' : 'Private Room'}</button>)}</div>
        {queueMode === 'private' && <input value={privateCode} onChange={(e) => setPrivateCode(normalizeCode(e.target.value))} className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3" placeholder="ALLY123" aria-label="Private room code" />}
        {(status || error) && <p className={`mt-3 text-center text-sm ${error ? 'text-rose-300' : 'text-cyan-200'}`}>{error || status}</p>}
        {players.map((player) => <div key={player.id || player.tpcAccountNumber} className="mt-2 flex justify-between rounded-xl bg-black/25 px-3 py-2 text-sm"><span>{player.name || 'Player'}</span><span className="text-emerald-300">Ready</span></div>)}
      </section>}
      <button type="button" disabled={matching} onClick={start} className="w-full rounded-2xl bg-cyan-300 px-4 py-4 font-black text-slate-950 disabled:opacity-60">{matching ? 'Finding ally…' : mode === 'online' ? 'Find Co-op Match' : 'Play Solo'}</button>
      {matching && <button type="button" onClick={() => cleanupRef.current?.()} className="w-full rounded-xl border border-white/10 py-3 text-sm">Cancel matchmaking</button>}
    </div>
  </main>;
}
