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

export default function BlackwaterLobby() {
  const navigate = useNavigate(),
    [params] = useSearchParams();
  useTelegramBackButton();
  const [mode, setMode] = useState(
      params.get('mode') === 'online' ? 'online' : 'ai'
    ),
    [weapon, setWeapon] = useState('ar'),
    [difficulty, setDifficulty] = useState('recruit');
  const [stake, setStake] = useState({ token: 'TPG', amount: 100 }),
    [maxPlayers, setMaxPlayers] = useState(2),
    [queueMode, setQueueMode] = useState('quick'),
    [code, setCode] = useState('');
  const [matching, setMatching] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [players, setPlayers] = useState([]);
  const cleanup = useRef(null),
    active = useRef(false),
    attempt = useRef(0),
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
    const query = new URLSearchParams({ mode, weapon, difficulty });
    if (match) {
      query.set('tableId', match.tableId);
      try {
        sessionStorage.setItem(
          'blackwater-match',
          JSON.stringify({ tableId: match.tableId, weapon })
        );
      } catch {}
    }
    navigate(`/games/tiranastreets?${query}`);
  };
  async function start() {
    if (starting.current || matching) return;
    if (mode === 'ai') {
      launch();
      return;
    }
    if (queueMode === 'private' && code.length < 4) {
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
        gameType: 'blackwater',
        stake,
        maxPlayers,
        playerName: getTelegramFirstName() || 'Operator',
        avatar: getTelegramPhotoUrl() || '',
        matchMeta: { mapId: 'tirana' },
        quickMatch: queueMode === 'quick',
        tableId:
          queueMode === 'private'
            ? `blackwater-${maxPlayers}-host-${code}`
            : '',
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
        setError(e.message || 'Could not join the lobby.');
        setMatching(false);
      }
    } finally {
      if (attempt.current === current) starting.current = false;
    }
  }
  function resume() {
    try {
      const match = JSON.parse(
        sessionStorage.getItem('blackwater-match') || 'null'
      );
      if (match?.tableId)
        navigate(
          `/games/tiranastreets?${new URLSearchParams({ mode: 'online', tableId: match.tableId, weapon: match.weapon || 'ar' })}`
        );
      else setError('No previous operation to reconnect to.');
    } catch {
      setError('No previous operation to reconnect to.');
    }
  }
  const tile = (selected) =>
    `rounded-xl border px-4 py-3 text-left ${selected ? 'border-amber-300/70 bg-amber-200/10 text-amber-100' : 'border-white/15 bg-white/5 text-white/75'}`;
  return (
    <main className="min-h-screen bg-[#070b16] px-4 pb-28 pt-5 text-white">
      <div className="mx-auto max-w-2xl space-y-5">
        <Link to="/games" className="inline-block text-sm text-white/70">
          ← Games
        </Link>
        <GameLobbyHeader
          slug="tiranastreets"
          title="Tirana Streets"
          badge="TIRANA · FPS"
          description="First-person operations through Tirana’s mapped streets, landmarks and city infrastructure."
        />
        <fieldset disabled={matching} className="space-y-5">
          <legend className="mb-3 text-xs uppercase tracking-widest text-white/60">
            Choose your operation
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['ai', 'Battlefield vs AI', 'Free · survival + city missions'],
              ['online', 'TPG multiplayer', '2–4 operators · one life']
            ].map(([id, title, detail]) => (
              <button
                key={id}
                type="button"
                className={tile(mode === id)}
                aria-pressed={mode === id}
                onClick={() => {
                  setMode(id);
                  setError('');
                }}
              >
                <strong className="block">{title}</strong>
                <small>{detail}</small>
              </button>
            ))}
          </div>
          <div>
            <h3 className="mb-2 text-sm text-white/70">Loadout</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['ar', 'MK18', 'Control & precision'],
                ['smg', 'MP9', 'Speed & mobility']
              ].map(([id, title, detail]) => (
                <button
                  key={id}
                  className={tile(weapon === id)}
                  aria-pressed={weapon === id}
                  onClick={() => setWeapon(id)}
                >
                  <strong className="block">{title}</strong>
                  <small>{detail}</small>
                </button>
              ))}
            </div>
          </div>
          {mode === 'ai' ? (
            <label className="block text-sm text-white/70">
              Difficulty
              <select
                className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-white"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="recruit">Recruit</option>
                <option value="veteran">Veteran</option>
              </select>
            </label>
          ) : (
            <>
              <div>
                <h3 className="mb-2 text-sm text-white/70">Entry stake</h3>
                <RoomSelector
                  selected={stake}
                  onSelect={setStake}
                  tokens={['TPG']}
                />
              </div>
              <label className="block text-sm text-white/70">
                Human players
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-white"
                >
                  {[2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} operators
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['quick', 'private'].map((id) => (
                  <button
                    key={id}
                    className={tile(queueMode === id)}
                    aria-pressed={queueMode === id}
                    onClick={() => setQueueMode(id)}
                  >
                    {id === 'quick' ? 'Quick match' : 'Private room'}
                  </button>
                ))}
              </div>
              {queueMode === 'private' ? (
                <label className="block text-sm text-white/70">
                  Room code
                  <input
                    value={code}
                    maxLength={8}
                    onChange={(e) =>
                      setCode(
                        e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase()
                      )
                    }
                    className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-white"
                    placeholder="4–8 LETTERS / NUMBERS"
                  />
                  <small>
                    Use the same code, player count and stake as your friends.
                  </small>
                </label>
              ) : null}
            </>
          )}
        </fieldset>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          {mode === 'ai' ? (
            <p>
              Play last operator standing or choose city operations from the battle menu. Move with
              the left thumb; drag on the right to aim.
            </p>
          ) : (
            <>
              <p className="mb-2 font-semibold text-amber-100">
                {stake.amount.toLocaleString()} TPG per player ·{' '}
                {(stake.amount * maxPlayers).toLocaleString()} TPG prize
              </p>
              <p>
                Last operator alive wins. No respawns. If several operators survive
                the 3-minute limit, every stake is refunded. Leaving an active match
                forfeits your place. You have 15 seconds to reconnect.
              </p>
              <p className="mt-2">
                Stakes lock when everyone is ready. Cancelling before matching
                is free. An incomplete start refunds all stakes.
              </p>
            </>
          )}
        </div>
        {players.length > 0 ? (
          <ul className="space-y-2" aria-label="Lobby players">
            {players.map((p) => (
              <li
                key={p.id || p.tpcAccountNumber}
                className="flex justify-between rounded-lg bg-white/5 px-4 py-2"
              >
                <span>{p.name || 'Operator'}</span>
                <span className="text-green-300">Ready</span>
              </li>
            ))}
          </ul>
        ) : null}
        {status || error ? (
          <p
            role={error ? 'alert' : 'status'}
            className={error ? 'text-red-300' : 'text-amber-100'}
          >
            {error || status}
            {matching && players.length
              ? ` (${players.length}/${maxPlayers})`
              : ''}
          </p>
        ) : null}
        <button
          type="button"
          disabled={matching}
          onClick={start}
          className="w-full rounded-xl bg-[#ecb07c] p-4 font-bold text-[#142226] disabled:opacity-60"
        >
          {matching
            ? 'FINDING OPERATORS…'
            : mode === 'online'
              ? 'FIND TPG MATCH'
              : 'DEPLOY TO TIRANA'}
        </button>
        {matching ? (
          <button className="w-full p-3 text-white/75" onClick={cancel}>
            Cancel matchmaking
          </button>
        ) : mode === 'online' ? (
          <button className="w-full p-3 text-white/75" onClick={resume}>
            Reconnect to previous match
          </button>
        ) : null}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs text-white/45"
        >
          Tirana Streets layout · © OpenStreetMap contributors
        </a>
      </div>
    </main>
  );
}
