import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function CrazyDiceLobby() {
  const navigate = useNavigate();
  useTelegramBackButton(() => navigate('/games', { replace: true }));

  const [players, setPlayers] = useState(2);
  const [rolls, setRolls] = useState(1);
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });

  const startGame = () => {
    const params = new URLSearchParams();
    params.set('players', players);
    params.set('rolls', rolls);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    navigate(`/games/crazydice?${params.toString()}`);
  };

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold text-center">Crazy Dice Lobby</h2>
      <div className="space-y-2">
        <h3 className="font-semibold">Players</h3>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => (
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
