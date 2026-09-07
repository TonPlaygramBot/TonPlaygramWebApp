import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { loadCareer, EVENTS } from '../../games/archeryroyal/career';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';
import {
  getTelegramFirstName,
  getTelegramPhotoUrl,
  getTelegramUsername
} from '../../utils/telegram.js';

const MODES = [
  ['ai', 'Vs AI', 'Club, Tour or Pro rival'],
  ['career', 'Career', 'Five-event championship'],
  ['online', 'TPG Online', 'Authoritative 1v1 duel']
];
const ARENAS = [
  ['royal-grounds', 'Royal Grounds', 'Classic daylight range'],
  ['alpine-range', 'Alpine Range', 'Warm mountain light'],
  ['neon-arena', 'Neon Arena', 'Night championship']
];

export default function ArcheryRoyalLobby() {
  useTelegramBackButton('/games');
  const navigate = useNavigate();
  const cleanup = useRef(null);
  const starting = useRef(false);
  const [mode, setMode] = useState('ai');
  const [difficulty, setDifficulty] = useState('tour');
  const [arena, setArena] = useState('royal-grounds');
  const [stake, setStake] = useState({ token: 'TPG', amount: 100 });
  const [queue, setQueue] = useState('quick');
  const [code, setCode] = useState('');
  const [matching, setMatching] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [players, setPlayers] = useState([]);
  const [career] = useState(() => loadCareer());

  useEffect(() => () => cleanup.current?.(), []);

  const launch = (match) => {
    const query = new URLSearchParams({ mode, difficulty, arena, format: 'standard' });
    if (match) {
      query.set('mode', 'online');
      query.set('tableId', match.tableId);
      query.set('accountId', match.accountId || '');
      query.set('arena', match.meta?.arena || arena);
    }
    navigate(`/games/archeryroyal?${query}`);
  };

  async function start() {
    if (starting.current || matching) return;
    if (mode !== 'online') return launch();
    if (queue === 'private' && code.length < 4) {
      setError('Enter a room code of 4–8 letters or numbers.');
      return;
    }
    starting.current = true;
    setMatching(true);
    setError('');
    try {
      await runSimpleOnlineFlow({
        gameType: 'archeryroyal',
        stake,
        maxPlayers: 2,
        playerName: getTelegramUsername()
          ? `@${getTelegramUsername()}`
          : getTelegramFirstName() || 'Archer',
        avatar: getTelegramPhotoUrl() || '',
        matchMeta: { arena, format: 'standard' },
        quickMatch: queue === 'quick',
        tableId: queue === 'private' ? `archeryroyal-2-host-${code}` : '',
        state: {
          setMatching,
          setMatchStatus: setStatus,
          setMatchError: setError,
          setMatchPlayers: setPlayers,
          setCleanup: (updater) => { cleanup.current = updater(); }
        },
        onMatched: launch
      });
    } catch (reason) {
      setError(reason.message || 'Could not enter the online range.');
      setMatching(false);
    } finally { starting.current = false; }
  }

  const tile = (active) => `rounded-2xl border p-4 text-left transition ${active ? 'border-amber-300 bg-amber-300/15 text-amber-50' : 'border-white/10 bg-white/5 text-white/75'}`;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#304534_0%,#101b19_45%,#070b0e_100%)] px-4 pb-28 pt-5 text-white">
      <div className="mx-auto max-w-2xl space-y-5">
        <Link to="/games" className="inline-block text-sm text-white/65">← Games</Link>
        <GameLobbyHeader
          slug="archeryroyal"
          title="Archery Royal Lobby"
          badge="3D TARGET ARCHERY"
          description="Read the wind. Hold your draw. Own the gold ring."
        />

        <fieldset disabled={matching} className="space-y-4">
          <legend className="mb-3 text-sm text-white/60">Choose your competition</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MODES.map(([id, title, detail]) => (
              <button type="button" key={id} aria-pressed={mode === id} onClick={() => { setMode(id); setError(''); }} className={tile(mode === id)}>
                <strong className="block">{title}</strong>
                <span className="mt-1 block text-xs">{detail}</span>
              </button>
            ))}
          </div>

          <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white/75">Competition arena</h2>
            <div className="grid grid-cols-3 gap-2">
              {ARENAS.map(([id, title, detail]) => (
                <button type="button" key={id} aria-pressed={arena === id} onClick={() => setArena(id)} className={tile(arena === id)}>
                  <strong className="block text-sm">{title}</strong>
                  <span className="mt-1 hidden text-xs sm:block">{detail}</span>
                </button>
              ))}
            </div>
          </section>

          {mode === 'ai' && (
            <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <h2 className="mb-3 text-sm font-semibold text-white/75">AI skill</h2>
              <div className="grid grid-cols-3 gap-2">
                {[['club', 'Club'], ['tour', 'Tour'], ['pro', 'Pro']].map(([id, label]) => (
                  <button type="button" key={id} aria-pressed={difficulty === id} onClick={() => setDifficulty(id)} className={tile(difficulty === id)}>{label}</button>
                ))}
              </div>
            </section>
          )}

          {mode === 'career' && (
            <section className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div><span className="text-xs text-amber-200">NEXT EVENT</span><h2 className="mt-1 font-semibold">{EVENTS[career.tournament]}</h2></div>
                <div className="text-right text-sm"><b>Level {career.level}</b><span className="block text-white/55">{career.wins}W · {career.losses}L</span></div>
              </div>
              <p className="mt-3 text-sm text-white/60">Win five venues, earn coins and upgrade bow accuracy and draw stability. Progress saves automatically.</p>
            </section>
          )}

          {mode === 'online' && (
            <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <h2 className="text-sm font-semibold text-white/75">TPG entry stake</h2>
              <RoomSelector selected={stake} onSelect={setStake} tokens={['TPG']} />
              <div className="grid grid-cols-2 gap-3">
                {['quick', 'private'].map((id) => <button type="button" key={id} aria-pressed={queue === id} onClick={() => setQueue(id)} className={tile(queue === id)}>{id === 'quick' ? 'Quick match' : 'Private room'}</button>)}
              </div>
              {queue === 'private' && (
                <label className="block text-sm text-white/70">Room code
                  <input value={code} maxLength={8} onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())} placeholder="4–8 LETTERS / NUMBERS" className="mt-2 block w-full rounded-xl border border-white/15 bg-[#111b1b] p-3 text-base text-white" />
                </label>
              )}
              <p className="text-xs leading-relaxed text-white/55">Nine arrows each. Shot intent, wind, rings, score, turns, timeouts and winner are verified by the server. Stakes lock only when both archers are ready.</p>
              {players.map((player) => <div key={player.id || player.tpcAccountNumber} className="flex justify-between rounded-xl bg-white/5 p-3 text-sm"><span>{player.name || 'Archer'}</span><span className="text-amber-300">Ready</span></div>)}
            </section>
          )}
        </fieldset>

        {(status || error) && <p role={error ? 'alert' : 'status'} className={`rounded-xl p-3 text-sm ${error ? 'bg-red-400/10 text-red-200' : 'bg-amber-300/10 text-amber-100'}`}>{error || status}</p>}
        <button type="button" disabled={matching} onClick={start} className="w-full rounded-2xl bg-amber-300 px-5 py-4 font-black tracking-wide text-slate-950 disabled:opacity-50">
          {matching ? 'Finding your opponent…' : mode === 'online' ? 'ENTER TPG MATCHMAKING' : mode === 'career' ? 'CONTINUE CAREER' : 'PLAY VS AI'}
        </button>
        {matching && <button type="button" onClick={() => cleanup.current?.()} className="w-full rounded-xl border border-white/20 p-3">Cancel matchmaking</button>}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/65"><b className="text-amber-200">How to shoot</b><p className="mt-2">Drag on the range to aim. Hold DRAW to build power, then release. Compensate for the live wind arrow before every shot.</p></div>
      </div>
    </main>
  );
}
