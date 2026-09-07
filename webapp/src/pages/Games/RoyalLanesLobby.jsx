import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';
import {
  getTelegramFirstName,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
export default function RoyalLanesLobby() {
  const navigate = useNavigate(),
    [params] = useSearchParams();
  useTelegramBackButton('/games');
  const [mode, setMode] = useState(
    params.get('mode') === 'online' ? 'online' : 'ai'
  );
  const [difficulty, setDifficulty] = useState('club');
  const [stake, setStake] = useState({ token: 'TPG', amount: 100 });
  const [queue, setQueue] = useState('quick');
  const [code, setCode] = useState('');
  const [matching, setMatching] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [players, setPlayers] = useState([]);
  const active = useRef(false),
    attempt = useRef(0),
    cleanup = useRef(null),
    starting = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      attempt.current++;
      cleanup.current?.();
    };
  }, []);
  const cancel = () => {
    attempt.current++;
    starting.current = false;
    cleanup.current?.();
    cleanup.current = null;
    setMatching(false);
    setPlayers([]);
    setStatus('');
  };
  const launch = (match) => {
    const query = new URLSearchParams({ mode, difficulty });
    if (match) {
      query.set('tableId', match.tableId);
      try {
        sessionStorage.setItem(
          'royallanes-match',
          JSON.stringify({ tableId: match.tableId })
        );
      } catch {}
    }
    navigate(`/games/royallanes?${query}`);
  };
  async function start() {
    if (starting.current || matching) return;
    if (mode === 'ai') {
      launch();
      return;
    }
    if (queue === 'private' && code.length < 4) {
      setError('Enter a room code of 4–8 letters or numbers.');
      return;
    }
    starting.current = true;
    const current = ++attempt.current;
    setMatching(true);
    setError('');
    const safe = (setter) => (value) => {
      if (active.current && attempt.current === current) setter(value);
    };
    try {
      await runSimpleOnlineFlow({
        gameType: 'royallanes',
        stake,
        maxPlayers: 2,
        playerName: getTelegramFirstName() || 'Bowler',
        avatar: getTelegramPhotoUrl() || '',
        matchMeta: { format: 'tenpin' },
        quickMatch: queue === 'quick',
        tableId: queue === 'private' ? `royallanes-2-host-${code}` : '',
        state: {
          setMatching: safe(setMatching),
          setMatchStatus: safe(setStatus),
          setMatchError: safe(setError),
          setMatchPlayers: safe(setPlayers),
          setCleanup: (updater) => {
            const fn = updater();
            if (!active.current || attempt.current !== current) fn();
            else cleanup.current = fn;
          }
        },
        onMatched: (match) => {
          if (active.current && attempt.current === current) launch(match);
        }
      });
    } catch (e) {
      if (active.current && attempt.current === current) {
        setError(e.message || 'Could not join the lane.');
        setMatching(false);
      }
    } finally {
      if (attempt.current === current) starting.current = false;
    }
  }
  const resume = () => {
    try {
      const match = JSON.parse(
        sessionStorage.getItem('royallanes-match') || 'null'
      );
      if (match?.tableId)
        navigate(
          `/games/royallanes?${new URLSearchParams({ mode: 'online', tableId: match.tableId })}`
        );
      else setError('No previous match to reconnect to.');
    } catch {
      setError('No previous match to reconnect to.');
    }
  };
  const tile = (selected) =>
    `rounded-xl border p-4 text-left ${selected ? 'border-[#dfbc7a] bg-[#dfbc7a]/10 text-[#f6dfb5]' : 'border-white/15 bg-white/5 text-white/75'}`;
  return (
    <main className="min-h-screen bg-[#101b14] px-4 pb-28 pt-5 text-white">
      <div className="mx-auto max-w-2xl space-y-5">
        <Link to="/games" className="inline-block text-sm text-white/70">
          ← Games
        </Link>
        <GameLobbyHeader
          slug="royallanes"
          title="Royal Lanes Lobby"
          badge="3D BOWLING"
          description="Ten frames. Human bowlers. Every pin counts."
        />
        <fieldset disabled={matching} className="space-y-5">
          <legend className="mb-3 text-sm text-white/60">
            Choose your match
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['ai', 'Vs AI', 'Free · choose your rival'],
              ['online', 'TPG online', 'Two human bowlers']
            ].map(([id, title, detail]) => (
              <button
                type="button"
                key={id}
                className={tile(mode === id)}
                aria-pressed={mode === id}
                onClick={() => {
                  setMode(id);
                  setError('');
                }}
              >
                <strong className="block">{title}</strong>
                <span className="mt-1 block text-sm">{detail}</span>
              </button>
            ))}
          </div>
          {mode === 'ai' ? (
            <label className="block text-sm text-white/75">
              AI level
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-white/20 bg-[#17281d] p-3 text-white"
              >
                <option value="casual">Casual</option>
                <option value="club">Club player</option>
                <option value="pro">Pro</option>
              </select>
            </label>
          ) : (
            <>
              <div>
                <h2 className="mb-2 text-sm text-white/75">Entry stake</h2>
                <RoomSelector
                  selected={stake}
                  onSelect={setStake}
                  tokens={['TPG']}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['quick', 'private'].map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={tile(queue === id)}
                    aria-pressed={queue === id}
                    onClick={() => setQueue(id)}
                  >
                    {id === 'quick' ? 'Quick match' : 'Private room'}
                  </button>
                ))}
              </div>
              {queue === 'private' && (
                <label className="block text-sm text-white/75">
                  Room code
                  <input
                    value={code}
                    maxLength={8}
                    autoCapitalize="characters"
                    onChange={(e) =>
                      setCode(
                        e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase()
                      )
                    }
                    className="mt-2 block w-full rounded-lg border border-white/20 bg-[#17281d] p-3 text-white"
                    placeholder="4–8 LETTERS / NUMBERS"
                  />
                  <span className="mt-2 block text-sm">
                    Use the same code and TPG stake as your friend.
                  </span>
                </label>
              )}
            </>
          )}
        </fieldset>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/75">
          <strong className="block text-[#efd09a]">Touch to bowl</strong>
          <p className="mt-2">
            Drag sideways to aim. Swipe up to release. Curve the end of your
            swipe to add left or right spin. Frames advance automatically.
          </p>
          <p className="mt-2">
            Watch from your bowler’s eyes as your opponent takes their turns.
            Tap with two fingers to pause an AI match.
          </p>
        </div>
        {mode === 'online' && (
          <div className="rounded-xl border border-[#dfbc7a]/20 bg-[#dfbc7a]/5 p-4 text-sm leading-relaxed text-white/75">
            <strong className="text-[#efd09a]">
              {stake.amount.toLocaleString()} TPG entry ·{' '}
              {(stake.amount * 2).toLocaleString()} TPG prize
            </strong>
            <p className="mt-2">
              Highest score after ten frames wins. A tie refunds both stakes.
              Stakes lock only when both players are ready.
            </p>
            <p className="mt-2">
              You have 35 seconds for each roll. Two consecutive missed turns
              forfeit the match. Reconnect within 30 seconds if your connection
              drops. Leaving an active match forfeits it; an incomplete start
              refunds both players.
            </p>
          </div>
        )}
        {players.length > 0 && (
          <ul className="space-y-2" aria-label="Lobby bowlers">
            {players.map((p) => (
              <li
                key={p.id || p.tpcAccountNumber}
                className="flex justify-between rounded-lg bg-white/5 px-4 py-3"
              >
                <span>{p.name || 'Bowler'}</span>
                <span className="text-[#dfbc7a]">Ready</span>
              </li>
            ))}
          </ul>
        )}
        {(status || error) && (
          <p
            role={error ? 'alert' : 'status'}
            className={error ? 'text-red-300' : 'text-[#efd09a]'}
          >
            {error || status}
          </p>
        )}
        <button
          type="button"
          disabled={matching}
          onClick={start}
          className="w-full rounded-xl bg-[#dfbc7a] p-4 font-semibold text-[#172017] disabled:opacity-60"
        >
          {matching
            ? 'Finding your opponent…'
            : mode === 'online'
              ? 'Find TPG match'
              : 'Play vs AI'}
        </button>
        {matching ? (
          <button
            type="button"
            className="w-full p-3 text-white/75"
            onClick={cancel}
          >
            Cancel matchmaking
          </button>
        ) : mode === 'online' ? (
          <button
            type="button"
            className="w-full p-3 text-white/75"
            onClick={resume}
          >
            Reconnect to match
          </button>
        ) : null}
      </div>
    </main>
  );
}
