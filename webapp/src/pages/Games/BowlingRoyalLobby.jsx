import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BowlingLobby from '../../games/bowling/Lobby';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { runSimpleOnlineFlow } from '../../utils/simpleOnlineFlow.js';
import {
  getTelegramFirstName,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { loadAvatar } from '../../utils/avatarUtils.js';

export default function BowlingRoyalLobby() {
  useTelegramBackButton();
  const navigate = useNavigate(),
    cleanup = useRef(null),
    starting = useRef(false);
  const [mode, setMode] = useState('ai'),
    [difficulty, setDifficulty] = useState(1),
    [stake, setStake] = useState({ token: 'TPG', amount: 100 });
  const [matching, setMatching] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [players, setPlayers] = useState([]);
  useEffect(() => () => cleanup.current?.(), []);
  async function start() {
    if (starting.current || matching) return;
    starting.current = true;
    setError('');
    try {
      if (mode === 'ai') {
        navigate(`/games/bowlingroyal?mode=ai&difficulty=${difficulty}`);
        return;
      }
      await runSimpleOnlineFlow({
        gameType: 'bowlingroyal',
        stake,
        maxPlayers: 2,
        matchMeta: { format: 'tenpin' },
        playerName: getTelegramFirstName() || 'Player',
        avatar: loadAvatar() || getTelegramPhotoUrl() || '',
        state: {
          setMatching,
          setMatchStatus: setStatus,
          setMatchError: setError,
          setMatchPlayers: setPlayers,
          setCleanup: (updater) => {
            // Shared flow supplies a React-setter updater that returns the cleanup.
            cleanup.current = updater();
          }
        },
        onMatched: ({ tableId }) =>
          navigate(
            `/games/bowlingroyal?${new URLSearchParams({ mode: 'online', tableId })}`
          )
      });
    } catch (e) {
      setError(e.message || 'Could not start bowling.');
    } finally {
      starting.current = false;
    }
  }
  return (
    <BowlingLobby
      mode={mode}
      onMode={setMode}
      difficulty={difficulty}
      onDifficulty={setDifficulty}
      onStart={start}
      onBack={() => navigate('/games')}
      matching={matching}
      onCancel={() => cleanup.current?.()}
      status={status}
      error={error}
      onlinePanel={
        <section className="br-lobby-section">
          <h2>Select TPG stake</h2>
          <fieldset disabled={matching}>
            <RoomSelector
              selected={stake}
              onSelect={setStake}
              tokens={['TPG']}
            />
          </fieldset>
          <p>
            Your TPG account joins the shared matchmaking queue. Both stakes
            lock when the match starts. The winner receives the pot; ties refund
            both players. You have 45 seconds to begin each throw.
          </p>
          {players.map((p) => (
            <div className="br-match-player" key={p.id}>
              <span>{p.name || 'Player'}</span>
              <span>Seated</span>
            </div>
          ))}
        </section>
      }
    />
  );
}
