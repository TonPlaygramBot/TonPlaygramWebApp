import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';
import { getTelegramFirstName } from '../../utils/telegram.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getVisualRoyalGame } from './visualRoyalGames';

export default function VisualRoyalLobby() {
  const { game = '' } = useParams();
  const config = useMemo(() => getVisualRoyalGame(game), [game]);
  const navigate = useNavigate();
  useTelegramBackButton('/games');
  const [mode, setMode] = useState<'ai' | 'online'>('ai');
  const [stake, setStake] = useState(100);
  const [matching, setMatching] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [cleanup, setCleanup] = useState<null | (() => void)>(null);
  useEffect(() => () => cleanup?.(), [cleanup]);
  if (!config) return <div className="p-6 text-center">Game not found.</div>;

  const launch = (online: Record<string, string> = {}) => {
    const query = new URLSearchParams({ mode, ...online });
    navigate(`/games/${config.slug}/royal-play?${query}`);
  };
  const start = async () => {
    if (mode === 'ai') return launch();
    await runSimpleOnlineFlow({
      gameType: config.gameType,
      stake: { token: 'TPG', amount: stake },
      maxPlayers: config.players,
      playerName: getTelegramFirstName() || 'Player',
      matchMeta: { rules: 'standard' },
      state: { setMatching, setMatchStatus: setStatus, setMatchError: setError, setCleanup },
      onMatched: ({ accountId, tableId }: { accountId: string; tableId: string }) => launch({ accountId, tableId })
    });
  };

  return <main className="min-h-screen bg-[#050914] p-4 text-white">
    <GameLobbyHeader slug={config.slug} title={`${config.title} Lobby`} badge={`${config.players} players`} />
    <section className="mx-auto mt-5 max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl">
      <div className="text-center text-7xl" aria-hidden>{config.icon}</div>
      <h1 className="mt-3 text-center text-2xl font-black">{config.title}</h1>
      <p className="mt-2 text-center text-sm text-white/65">{config.objective}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {(['ai', 'online'] as const).map((choice) => <button key={choice} onClick={() => setMode(choice)} className={`rounded-2xl border p-4 font-bold ${mode === choice ? 'border-cyan-300 bg-cyan-400/20' : 'border-white/10 bg-black/20'}`}>{choice === 'ai' ? '🤖 Practice' : '🌐 Online'}</button>)}
      </div>
      {mode === 'online' && <label className="mt-5 block text-sm font-semibold">Stake
        <select value={stake} onChange={(event) => setStake(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111827] p-3">
          {[50, 100, 250, 500].map((value) => <option key={value} value={value}>{value} TPG</option>)}
        </select>
      </label>}
      {status && <p className="mt-4 text-center text-sm text-cyan-200">{status}</p>}
      {error && <p role="alert" className="mt-4 text-center text-sm text-red-300">{error}</p>}
      <button disabled={matching} onClick={start} style={{ background: config.accent }} className="mt-6 w-full rounded-2xl px-5 py-4 text-lg font-black text-slate-950 disabled:opacity-50">{matching ? 'Finding players…' : mode === 'online' ? 'Find Match' : 'Play Practice'}</button>
    </section>
  </main>;
}
