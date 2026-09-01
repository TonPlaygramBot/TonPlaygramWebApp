import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getAccountBalance } from '../../utils/api.js';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';
import { socket } from '../../utils/socket.js';
import { ensureAccountId, getTelegramFirstName, getTelegramId } from '../../utils/telegram.js';

const GAMES = {
  '2048royale': { title: '2048 Royale', gameType: '2048royale', icon: '🔢', accent: 'amber', description: 'Slide, merge, and outscore your opponent on the same two-minute clock.' },
  'hextrisbattle': { title: 'Hextris Battle', gameType: 'hextrisbattle', icon: '⬢', accent: 'fuchsia', description: 'Match falling colors around the core and build the longest combo.' },
  'underrunarena': { title: 'Underrun Arena', gameType: 'underrunarena', icon: '🚀', accent: 'cyan', description: 'Survive the neon swarm and race your opponent for the highest score.' }
};

const normalizeCode = (value = '') => String(value).replace(/[^a-z0-9_-]/gi, '').toUpperCase().slice(0, 24);

export default function ArcadeRaceLobby({ gameSlug }) {
  useTelegramBackButton();
  const navigate = useNavigate();
  const game = GAMES[gameSlug];
  const cleanupRef = useRef(null);
  const [mode, setMode] = useState('online');
  const [stake, setStake] = useState({ token: 'TPG', amount: 100 });
  const [queueMode, setQueueMode] = useState('quick');
  const [privateCode, setPrivateCode] = useState('');
  const [matching, setMatching] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [players, setPlayers] = useState([]);

  useEffect(() => () => cleanupRef.current?.({ refund: true }), []);

  const openGame = ({ tableId = '', accountId = '' } = {}) => {
    const params = new URLSearchParams({ mode, token: stake.token, amount: String(stake.amount) });
    if (tableId) params.set('tableId', tableId);
    if (accountId) params.set('accountId', accountId);
    navigate(`/games/${gameSlug}?${params}`);
  };

  const start = async () => {
    if (mode === 'solo') return openGame();
    const tableId = queueMode === 'private' && privateCode
      ? `${game.gameType}-2-host-${normalizeCode(privateCode)}`
      : '';
    if (queueMode === 'private' && !tableId) {
      setError('Enter a private room code first.');
      return;
    }
    await runSimpleOnlineFlow({
      gameType: game.gameType,
      stake,
      maxPlayers: 2,
      playerName: getTelegramFirstName() || 'Player',
      tableId,
      quickMatch: queueMode === 'quick',
      matchMeta: { format: 'score-race', durationSeconds: 120 },
      state: {
        setMatching,
        setMatchStatus: setStatus,
        setMatchError: setError,
        setMatchPlayers: setPlayers,
        setCleanup: (cleanup) => { cleanupRef.current = cleanup; }
      },
      deps: { ensureAccountId, getAccountBalance, getTelegramId, socket },
      onMatched: openGame
    });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050711] px-4 pb-28 pt-4 text-white">
      <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.18),transparent_46%)] ${game.accent === 'amber' ? 'hue-rotate-[155deg]' : game.accent === 'fuchsia' ? 'hue-rotate-[70deg]' : ''}`} />
      <div className="relative mx-auto max-w-lg space-y-4">
        <GameLobbyHeader slug={gameSlug} title={`${game.title} Lobby`} subtitle={game.description} />

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/55">Choose mode</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { id: 'online', title: 'Online Race', text: 'Match with a real player.' },
              { id: 'solo', title: 'Solo Practice', text: 'Learn with no stake.' }
            ].map((item) => (
              <button key={item.id} type="button" onClick={() => setMode(item.id)} className={`rounded-2xl border p-4 text-left transition ${mode === item.id ? 'border-cyan-300 bg-cyan-300/15' : 'border-white/10 bg-black/20'}`}>
                <span className="text-2xl" aria-hidden="true">{item.id === 'online' ? game.icon : '🎯'}</span>
                <strong className="mt-3 block text-sm">{item.title}</strong>
                <span className="mt-1 block text-xs text-white/55">{item.text}</span>
              </button>
            ))}
          </div>
        </section>

        {mode === 'online' && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
            <RoomSelector selected={stake} onSelect={setStake} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {['quick', 'private'].map((value) => (
                <button key={value} type="button" onClick={() => setQueueMode(value)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${queueMode === value ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-white/10 text-white/60'}`}>
                  {value === 'quick' ? 'Quick Match' : 'Private Room'}
                </button>
              ))}
            </div>
            {queueMode === 'private' && <input value={privateCode} onChange={(event) => setPrivateCode(normalizeCode(event.target.value))} className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-cyan-300" placeholder="FRIEND123" aria-label="Private room code" />}
            {(status || error) && <p className={`mt-3 text-center text-sm ${error ? 'text-rose-300' : 'text-cyan-200'}`}>{error || status}</p>}
            {players.map((player) => <div key={player.id || player.tpcAccountNumber} className="mt-2 flex justify-between rounded-xl bg-black/25 px-3 py-2 text-sm"><span>{player.name || 'Player'}</span><span className="text-emerald-300">Ready</span></div>)}
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm text-white/65">
          <strong className="text-white">How online works</strong>
          <p className="mt-2">Both players start together, play the same two-minute format, and see the opponent score update live. Highest verified score wins.</p>
        </section>

        <button type="button" disabled={matching} onClick={start} className="w-full rounded-2xl bg-cyan-300 px-4 py-4 text-base font-black text-slate-950 shadow-lg shadow-cyan-500/20 disabled:opacity-60">
          {matching ? 'Finding opponent…' : mode === 'online' ? 'Find Match' : `Practice ${game.title}`}
        </button>
        {matching && <button type="button" onClick={() => cleanupRef.current?.()} className="w-full rounded-xl border border-white/10 py-3 text-sm text-white/70">Cancel matchmaking</button>}
      </div>
    </main>
  );
}
