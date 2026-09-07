import { ARENAS, CHARACTERS } from '../../games/tabletennis/options';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';
import {
  getTelegramFirstName,
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { socket } from '../../utils/socket.js';

const modes = [
  ['ai', 'Vs AI', 'Free exhibition'],
  ['career', 'Career', 'Five tournament tour'],
  ['online', 'Online', 'Same-stake opponent']
];
const arenas = ARENAS.map((a) => [a.id, a.name]);
const formats = [
  ['quick', 'One game'],
  ['set', 'Best of 3'],
  ['full', 'Best of 5']
];
export default function TableTennisRoyalLobby() {
  useTelegramBackButton();
  const navigate = useNavigate(),
    cleanup = useRef(null),
    starting = useRef(false);
  const [mode, setMode] = useState('ai'),
    [arena, setSurface] = useState('dancingHall'),
    [character, setCharacter] = useState('athlete-male'),
    [format, setFormat] = useState('set'),
    [difficulty, setDifficulty] = useState(1),
    [stake, setStake] = useState({ token: 'TPG', amount: 100 });
  const [matching, setMatching] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [players, setPlayers] = useState([]);
  useEffect(() => () => cleanup.current?.(), []);
  useEffect(() => {
    const failed = ({ error: message }) => {
      cleanup.current?.();
      setError(String(message || 'Match could not start').replaceAll('_', ' '));
    };
    socket.on('tabletennisLobbyError', failed);
    return () => socket.off('tabletennisLobbyError', failed);
  }, []);
  const start = async () => {
    if (starting.current || matching) return;
    starting.current = true;
    setError('');
    try {
      if (mode !== 'online') {
        navigate(
          `/games/tabletennisroyal?${new URLSearchParams({ mode, arena, format, character, difficulty: String(difficulty) })}`
        );
        return;
      }
      await runSimpleOnlineFlow({
        gameType: 'tabletennisroyal',
        stake,
        maxPlayers: 2,
        playerName: getTelegramUsername()
          ? `@${getTelegramUsername()}`
          : getTelegramFirstName() || 'Player',
        avatar: loadAvatar() || getTelegramPhotoUrl() || '',
        matchMeta: { arena, format },
        state: {
          setMatching,
          setMatchStatus: setStatus,
          setMatchError: setError,
          setMatchPlayers: setPlayers,
          setCleanup: (fn) => {
            cleanup.current = fn;
          }
        },
        onMatched: ({ tableId, meta }) => {
          // The server's start payload owns the match options and player seats.
          navigate(
            `/games/tabletennisroyal?${new URLSearchParams({ mode: 'online', tableId, character, arena: meta.arena, format: meta.format })}`
          );
        }
      });
    } catch (e) {
      setError(e.message || 'Could not start tabletennis.');
    } finally {
      starting.current = false;
    }
  };
  const choices = (items, value, setter) => (
    <div className="grid grid-cols-3 gap-2">
      {items.map(([id, label, detail]) => (
        <button
          type="button"
          key={id}
          aria-pressed={value === id}
          disabled={matching}
          onClick={() => setter(id)}
          className={`rounded-xl border p-3 text-left disabled:opacity-50 ${value === id ? 'border-lime-300 bg-lime-300/15' : 'border-white/10 bg-black/20'}`}
        >
          <strong className="block text-sm">{label}</strong>
          {detail && (
            <span className="mt-1 block text-xs text-white/60">{detail}</span>
          )}
        </button>
      ))}
    </div>
  );
  return (
    <main className="min-h-screen bg-[#070b16] p-4 pb-28 text-white">
      <div className="mx-auto max-w-lg space-y-4">
        <GameLobbyHeader
          slug="tabletennisroyal"
          title="Table Tennis Royal Lobby"
          badge="3D table tennis"
        />
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold">Choose your match</h3>
          {choices(modes, mode, setMode)}
        </section>
        <label className="block space-y-2 text-sm">
          Human player
          <select
            disabled={matching}
            value={character}
            onChange={(e) => setCharacter(e.target.value)}
            className="block w-full rounded-xl bg-slate-800 p-3 text-base"
          >
            {CHARACTERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.description}
              </option>
            ))}
          </select>
        </label>
        {mode !== 'career' && (
          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">Arena</h3>
            {choices(arenas, arena, setSurface)}
            <h3 className="pt-2 font-semibold">Match length</h3>
            {choices(formats, format, setFormat)}
            <p className="text-xs text-white/60">
              {format === 'full'
                ? 'Best of five games to 11, win by two.'
                : format === 'set'
                  ? 'Best of three games to 11, win by two.'
                  : 'One game to 11, win by two.'}
            </p>
          </section>
        )}
        {mode === 'ai' && (
          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">AI level</h3>
            {choices(
              [
                [0, 'Club'],
                [1, 'Tour'],
                [2, 'Pro']
              ],
              difficulty,
              setDifficulty
            )}
          </section>
        )}
        {mode === 'career' && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Play quarter-finals, semi-finals and finals across five tournaments.
            Train footwork, power and reach. Career progress saves to your TPC
            account; solo play has no stake.
          </section>
        )}
        {mode === 'online' && (
          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">Select stake</h3>
            <fieldset disabled={matching}>
              <RoomSelector
                selected={stake}
                onSelect={setStake}
                tokens={['TPG']}
              />
            </fieldset>
            <p className="text-xs text-white/60">
              Matches use your TPC account and pair the same stake, arena and
              match length. Stakes lock when both players are ready. The winner
              receives the two-player pot. Leaving an active match counts as
              retirement.
            </p>
            {players.map((p) => (
              <div
                key={p.id}
                className="flex justify-between rounded-xl bg-black/20 p-3 text-sm"
              >
                <span>{p.name || 'Player'}</span>
                <span className="text-lime-300">Ready</span>
              </div>
            ))}
          </section>
        )}
        {(status || error) && (
          <p
            role={error ? 'alert' : 'status'}
            className={`rounded-xl p-3 text-sm ${error ? 'bg-rose-400/10 text-rose-200' : 'bg-lime-300/10 text-lime-200'}`}
          >
            {error || status}
          </p>
        )}
        <button
          type="button"
          disabled={matching}
          onClick={start}
          className="w-full rounded-xl bg-lime-300 px-4 py-4 font-bold text-slate-950 disabled:opacity-50"
        >
          {matching
            ? 'Finding your opponent…'
            : mode === 'online'
              ? 'Find same-stake match'
              : mode === 'career'
                ? 'Continue career'
                : 'Play vs AI'}
        </button>
        {matching && (
          <button
            type="button"
            onClick={() => cleanup.current?.()}
            className="w-full rounded-xl border border-white/20 p-3"
          >
            Cancel matchmaking
          </button>
        )}
        <p className="text-center text-xs text-white/50">
          Tap SERVE · drag the table to aim · switch spin · assisted or manual
          returns
        </p>
      </div>
    </main>
  );
}
