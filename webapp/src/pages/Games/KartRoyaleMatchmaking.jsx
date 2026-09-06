import { useEffect, useRef, useState } from 'react';
import RoomSelector from '../../components/RoomSelector.jsx';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';

const normalizeCode = (value) =>
  String(value)
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 8);

/** Uses the same TPG registration, seatTable, ready, start and cancel flow as Royal games. */
export default function KartRoyaleMatchmaking({
  onMatched,
  trackId,
  loaded,
  playerName,
  onResume,
  canResume
}) {
  const [stake, setStake] = useState({ token: 'TPG', amount: 100 });
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [queueMode, setQueueMode] = useState('quick');
  const [code, setCode] = useState('');
  const [matching, setMatching] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [players, setPlayers] = useState([]);
  const cleanup = useRef(null);
  const active = useRef(false);
  const starting = useRef(false);
  const attempt = useRef(0);
  const cancel = () => {
    attempt.current += 1;
    starting.current = false;
    cleanup.current?.();
    setMatching(false);
    setStatus('');
  };
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      attempt.current += 1;
      cleanup.current?.();
    };
  }, []);
  // A changed circuit means a different queue. Release the old seat first.
  useEffect(() => {
    cancel();
  }, [trackId]);

  const start = async () => {
    if (starting.current || matching || !loaded) return;
    if (queueMode === 'private' && code.length < 4) {
      setError('Enter a room code of 4–8 letters or numbers.');
      return;
    }
    starting.current = true;
    const currentAttempt = ++attempt.current;
    setMatching(true);
    setError('');
    try {
      await runSimpleOnlineFlow({
        gameType: 'kartroyale',
        stake,
        maxPlayers,
        playerName,
        matchMeta: { trackId },
        quickMatch: queueMode === 'quick',
        tableId:
          queueMode === 'private'
            ? `kartroyale-${maxPlayers}-host-${code}`
            : '',
        state: {
          setMatching,
          setMatchStatus: setStatus,
          setMatchError: setError,
          setMatchPlayers: setPlayers,
          // The shared helper accepts React's function-updater setter contract.
          setCleanup: (updater) => {
            cleanup.current = updater();
          }
        },
        onMatched: async (match) => {
          if (!active.current || currentAttempt !== attempt.current) return;
          setMatching(true);
          setStatus('Grid confirmed. Joining the race…');
          try {
            await onMatched(match);
          } catch (err) {
            if (active.current) {
              setError(err.message);
              setMatching(false);
            }
          }
        }
      });
    } catch (err) {
      if (active.current) {
        setError(err.message);
        setMatching(false);
      }
    } finally {
      if (currentAttempt === attempt.current) starting.current = false;
    }
  };

  return (
    <div className="kr-tpg-lobby">
      <div className="kr-section-line">
        <span className="kr-label">TPG RACING LOBBY</span>
        <b>{maxPlayers} RACERS</b>
      </div>
      <fieldset disabled={matching} className="kr-tpg-settings">
        <legend className="kr-label">Entry stake</legend>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPG']} />
        <label className="kr-label" htmlFor="kr-grid-size">
          Human racers
        </label>
        <select
          id="kr-grid-size"
          className="kr-input"
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
        >
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} players
            </option>
          ))}
        </select>
        <div className="kr-row">
          {['quick', 'private'].map((m) => (
            <button
              key={m}
              type="button"
              className={`kr-secondary ${queueMode === m ? 'kr-selected' : ''}`}
              aria-pressed={queueMode === m}
              onClick={() => setQueueMode(m)}
            >
              {m === 'quick' ? 'Quick match' : 'Private room'}
            </button>
          ))}
        </div>
        {queueMode === 'private' && (
          <>
            <input
              className="kr-input kr-code"
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              placeholder="ROOM CODE"
              aria-label="Private room code"
              maxLength={8}
            />
            <p className="kr-room-note">
              Share the same code, circuit, stake and player count with your
              friends.
            </p>
          </>
        )}
      </fieldset>
      <div className="kr-tpg-pot">
        <span>{stake.amount.toLocaleString()} TPG per racer</span>
        <b>{(stake.amount * maxPlayers).toLocaleString()} TPG prize</b>
      </div>
      <p className="kr-room-note">
        First finisher wins the pot. Stakes lock when the full grid is ready.
        Cancel before matching for free. An incomplete start or a race with no
        finisher refunds every stake.
      </p>
      {players.length > 0 && (
        <div className="kr-room-players">
          {players.map((p, i) => (
            <div key={p.tpcAccountNumber || p.id}>
              <span>{i + 1}</span>
              <b>{p.name || 'Racer'}</b>
              <small className="ready">Ready</small>
            </div>
          ))}
        </div>
      )}
      {(status || error) && (
        <p className="kr-notice" role="status">
          {error || status}
          {matching && players.length
            ? ` (${players.length}/${maxPlayers})`
            : ''}
        </p>
      )}
      <button
        type="button"
        className="kr-start"
        disabled={matching || !loaded}
        onClick={start}
      >
        {!loaded
          ? 'LOADING YOUR KART…'
          : matching
            ? 'FINDING RACERS…'
            : queueMode === 'private'
              ? 'JOIN PRIVATE GRID'
              : 'FIND TPG RACE'}
      </button>
      {matching && (
        <button type="button" className="kr-text kr-full" onClick={cancel}>
          Cancel matchmaking
        </button>
      )}
      {canResume && !matching && (
        <button type="button" className="kr-text kr-full" onClick={onResume}>
          Reconnect to previous race
        </button>
      )}
    </div>
  );
}
