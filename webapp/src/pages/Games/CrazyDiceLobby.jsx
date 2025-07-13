import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pingOnline, getOnlineCount } from '../../utils/api.js';
import { getPlayerId } from '../../utils/telegram.js';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function CrazyDiceLobby() {
  const navigate = useNavigate();
  useTelegramBackButton(() => navigate('/games', { replace: true }));

  // Number of human opponents (excluding the current player)
  const [players, setPlayers] = useState(1);
  const [rolls, setRolls] = useState(1);
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [vsAI, setVsAI] = useState(false);
  const [aiCount, setAiCount] = useState(1);
  const [online, setOnline] = useState(0);

  useEffect(() => {
    const playerId = getPlayerId();
    function ping() {
      pingOnline(playerId).catch(() => {});
      getOnlineCount()
        .then((d) => setOnline(d.count))
        .catch(() => {});
    }
    ping();
    const id = setInterval(ping, 30000);
    return () => clearInterval(id);
  }, []);

  const startGame = () => {
    const params = new URLSearchParams();
    if (vsAI) {
      params.set('ai', aiCount);
      params.set('players', aiCount + 1);
    } else {
      // Convert opponent count to total player count
      params.set('players', players + 1);
    }
    params.set('rolls', rolls);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    navigate(`/games/crazydice?${params.toString()}`);
  };

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold text-center">Crazy Dice Lobby</h2>
      <p className="text-center text-sm">Online users: {online}</p>
      <div className="space-y-2">
        <h3 className="font-semibold">Mode</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setVsAI(false)}
            className={`lobby-tile ${!vsAI ? 'lobby-selected' : ''}`}
          >
            Players
          </button>
          <button
            onClick={() => setVsAI(true)}
            className={`lobby-tile ${vsAI ? 'lobby-selected' : ''}`}
          >
            Vs AI
          </button>
        </div>
      </div>
      {!vsAI && (
        <div className="space-y-2">
          <h3 className="font-semibold">Players</h3>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setPlayers(n)}
                className={`lobby-tile ${players === n ? 'lobby-selected' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      {vsAI && (
        <div className="space-y-2">
          <h3 className="font-semibold">AI Opponents</h3>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setAiCount(n)}
                className={`lobby-tile ${aiCount === n ? 'lobby-selected' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">Rolls</h3>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRolls(n)}
              className={`lobby-tile ${rolls === n ? 'lobby-selected' : ''}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Select Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} />
      </div>
      <button
        onClick={startGame}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
      >
        Start Game
      </button>
    </div>
  );
}
