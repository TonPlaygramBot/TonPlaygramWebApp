import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';
import {
  getTelegramFirstName,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getTabletopGame, TABLETOP_GAMES } from './shared/catalog.mjs';
import { ROOM_OPTIONS } from './roomOptions';
import './tabletop.css';
export default function TabletopLobby({ gameId }: { gameId: string }) {
  const game = getTabletopGame(gameId)!,
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [mode, setMode] = useState(
      params.get('mode') === 'online' ? 'online' : 'ai'
    ),
    [count, setCount] = useState(2),
    [difficulty, setDifficulty] = useState('club'),
    [room, setRoom] = useState('club');
  const [stake, setStake] = useState({ token: 'TPG', amount: 100 }),
    [queue, setQueue] = useState('quick'),
    [code, setCode] = useState(''),
    [matching, setMatching] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [players, setPlayers] = useState<any[]>([]);
  const cleanup = useRef<null | (() => void)>(null),
    attempt = useRef(0),
    active = useRef(false),
    starting = useRef(false);
  useTelegramBackButton('/games');
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      attempt.current++;
      cleanup.current?.();
    };
  }, []);
  function cancel() {
    attempt.current++;
    cleanup.current?.();
    cleanup.current = null;
    starting.current = false;
    setMatching(false);
    setStatus('');
    setPlayers([]);
  }
  function launch(tableId?: string) {
    const query = new URLSearchParams({
      mode,
      players: String(count),
      difficulty,
      room
    });
    if (tableId) {
      query.set('tableId', tableId);
      try {
        sessionStorage.setItem(
          `${gameId}-match`,
          JSON.stringify({ tableId, room })
        );
      } catch {}
    }
    navigate(`/games/${gameId}?${query}`);
  }
  async function start() {
    if (starting.current || matching) return;
    if (mode === 'ai') {
      launch();
      return;
    }
    if (queue === 'private' && code.length < 4) {
      setError('Use a room code of 4–8 letters or numbers.');
      return;
    }
    starting.current = true;
    const current = ++attempt.current;
    setMatching(true);
    setError('');
    const safe = (fn: any) => (v: any) => {
      if (active.current && current === attempt.current) fn(v);
    };
    try {
      await runSimpleOnlineFlow({
        gameType: gameId,
        stake,
        maxPlayers: count,
        playerName: getTelegramFirstName() || 'Player',
        avatar: getTelegramPhotoUrl() || '',
        matchMeta: { format: 'classic' },
        quickMatch: queue === 'quick',
        tableId: queue === 'private' ? `${gameId}-${count}-host-${code}` : '',
        state: {
          setMatching: safe(setMatching),
          setMatchStatus: safe(setStatus),
          setMatchError: safe(setError),
          setMatchPlayers: safe(setPlayers),
          setCleanup: (updater: any) => {
            const fn = updater();
            if (!active.current || current !== attempt.current) fn();
            else cleanup.current = fn;
          }
        },
        onMatched: (match: any) => {
          if (active.current && current === attempt.current)
            launch(match.tableId);
        }
      });
    } catch {
      safe(setError)('Could not join. Please retry.');
      safe(setMatching)(false);
    } finally {
      if (current === attempt.current) starting.current = false;
    }
  }
  function resume() {
    try {
      const previous = JSON.parse(
        sessionStorage.getItem(`${gameId}-match`) || 'null'
      );
      if (!previous?.tableId) throw Error();
      navigate(
        `/games/${gameId}?${new URLSearchParams({ mode: 'online', tableId: previous.tableId, room: previous.room || 'club' })}`
      );
    } catch {
      setError('No previous match on this device.');
    }
  }
  return (
    <main
      className="tt-lobby"
      style={{ '--tt-accent': game.color } as React.CSSProperties}
    >
      <div className="tt-lobby-inner">
        <Link to="/games" className="tt-back">
          ← Games
        </Link>
        <header className="tt-lobby-hero">
          <span className="tt-eyebrow">TONPLAYGRAM · {game.genre}</span>
          <img src={`/assets/tabletop/${gameId}.svg`} alt="" />
          <h1>{game.name}</h1>
          <p>{game.description}</p>
          <span className="tt-tag">2–4 PLAYERS · 3D TABLETOP</span>
        </header>
        <fieldset disabled={matching}>
          <legend>Choose your game</legend>
          <div className="tt-choice-grid">
            {[
              ['ai', 'Practice vs AI', 'Free · no TPG stake'],
              ['online', 'TPG Online', '1v1 or multiplayer']
            ].map(([id, name, detail]) => (
              <button
                key={id}
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
              >
                <strong>{name}</strong>
                <small>{detail}</small>
              </button>
            ))}
          </div>
          <label>
            Players
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n === 2 ? '1v1' : `${n} players`}
                  {mode === 'ai' ? ` · You + ${n - 1} AI` : ''}
                </option>
              ))}
            </select>
          </label>
          {mode === 'ai' ? (
            <label>
              AI level
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="casual">Casual</option>
                <option value="club">Club strategist</option>
              </select>
            </label>
          ) : (
            <>
              <label>Entry stake</label>
              <RoomSelector
                selected={stake}
                onSelect={setStake}
                tokens={['TPG']}
              />
              <div className="tt-choice-grid">
                {['quick', 'private'].map((id) => (
                  <button
                    key={id}
                    aria-pressed={queue === id}
                    onClick={() => setQueue(id)}
                  >
                    {id === 'quick' ? 'Quick match' : 'Private room'}
                  </button>
                ))}
              </div>
              {queue === 'private' && (
                <label>
                  Room code
                  <input
                    placeholder="4–8 LETTERS / NUMBERS"
                    maxLength={8}
                    value={code}
                    onChange={(e) =>
                      setCode(
                        e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase()
                      )
                    }
                  />
                  <small>
                    Friends use the same code, player count and stake.
                  </small>
                </label>
              )}
            </>
          )}
          <label>
            Playing room
            <select value={room} onChange={(e) => setRoom(e.target.value)}>
              {ROOM_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        {mode === 'online' && (
          <p className="tt-stake-note">
            <strong>
              {stake.amount.toLocaleString()} TPG entry ·{' '}
              {(stake.amount * count).toLocaleString()} TPG prize
            </strong>
            Stakes lock only when every seat is ready. The winner receives the
            pot; a draw, failed start or 30-minute match limit refunds stakes.
            You have 60 seconds per turn and to reconnect. Leaving or timing out
            forfeits your seat.
          </p>
        )}
        <details className="tt-rules">
          <summary>How to play {game.name}</summary>
          <ol>
            {game.rules.map((r: string) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </details>
        {players.length > 0 && (
          <ul className="tt-roster">
            {players.map((p, i) => (
              <li key={p.id || i}>
                {p.name || 'Player'} <span>Ready</span>
              </li>
            ))}
          </ul>
        )}
        {(status || error) && (
          <p
            role={error ? 'alert' : 'status'}
            className={error ? 'tt-error' : ''}
          >
            {error || status}
          </p>
        )}
        <button className="tt-primary" disabled={matching} onClick={start}>
          {matching
            ? `Finding players · ${players.length}/${count}`
            : mode === 'ai'
              ? 'Play vs AI'
              : 'Find TPG match'}
        </button>
        {matching ? (
          <button className="tt-text-button" onClick={cancel}>
            Cancel matchmaking
          </button>
        ) : (
          mode === 'online' && (
            <button className="tt-text-button" onClick={resume}>
              Reconnect to previous match
            </button>
          )
        )}
        <nav className="tt-more" aria-label="Other tabletop games">
          {TABLETOP_GAMES.filter((g) => g.id !== gameId).map((g) => (
            <Link key={g.id} to={`/games/${g.id}/lobby`}>
              {g.name}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
