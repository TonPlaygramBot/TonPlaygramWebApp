import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../../utils/socket.js';
import { getTelegramId, getTelegramFirstName } from '../../utils/telegram.js';
import { getSnakeBoard } from '../../utils/api.js';

const COLORS = ['#60a5fa', '#ef4444', '#4ade80', '#facc15'];

export default function SnakeMultiplayer() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const table = params.get('table') || 'snake-2';
  const telegramId = String(getTelegramId());
  const name = getTelegramFirstName() || telegramId;

  const [players, setPlayers] = useState([]); // {id,name,position,color}
  const [currentTurn, setCurrentTurn] = useState(null);
  const [dice, setDice] = useState(null);
  const [winner, setWinner] = useState(null);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    getSnakeBoard(table).catch(() => {});
    socket.emit('joinRoom', { roomId: table, playerId: telegramId, name });

    const onPlayerJoined = ({ playerId, name }) =>
      setPlayers((p) => {
        if (p.some((pl) => pl.id === playerId)) return p;
        const color = COLORS[p.length % COLORS.length];
        return [...p, { id: playerId, name, position: 0, color }];
      });
    const onGameStarted = () => setWaiting(false);
    const onTurnChanged = ({ playerId }) => setCurrentTurn(playerId);
    const onDiceRolled = ({ playerId, value }) => setDice(value);
    const onMove = ({ playerId, to }) =>
      setPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, position: to } : pl)));
    const onSnakeLadder = ({ playerId, to }) =>
      setPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, position: to } : pl)));
    const onPlayerReset = ({ playerId }) =>
      setPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, position: 0 } : pl)));
    const onPlayerLeft = ({ playerId }) =>
      setPlayers((p) => p.filter((pl) => pl.id !== playerId));
    const onGameWon = ({ playerId }) => setWinner(playerId);

    socket.on('playerJoined', onPlayerJoined);
    socket.on('gameStarted', onGameStarted);
    socket.on('turnChanged', onTurnChanged);
    socket.on('diceRolled', onDiceRolled);
    socket.on('movePlayer', onMove);
    socket.on('snakeOrLadder', onSnakeLadder);
    socket.on('playerReset', onPlayerReset);
    socket.on('playerLeft', onPlayerLeft);
    socket.on('gameWon', onGameWon);

    return () => {
      socket.off('playerJoined', onPlayerJoined);
      socket.off('gameStarted', onGameStarted);
      socket.off('turnChanged', onTurnChanged);
      socket.off('diceRolled', onDiceRolled);
      socket.off('movePlayer', onMove);
      socket.off('snakeOrLadder', onSnakeLadder);
      socket.off('playerReset', onPlayerReset);
      socket.off('playerLeft', onPlayerLeft);
      socket.off('gameWon', onGameWon);
    };
  }, [table, telegramId, name]);

  const handleRoll = () => {
    socket.emit('rollDice');
  };

  const cells = [];
  for (let r = 9; r >= 0; r--) {
    for (let c = 0; c < 10; c++) {
      const num = r % 2 === 0 ? r * 10 + c + 1 : r * 10 + (9 - c) + 1;
      cells.push(num);
    }
  }

  return (
    <div className="p-4 space-y-2 text-text">
      <h2 className="text-xl font-bold text-center">Multiplayer Snake &amp; Ladder</h2>
      {waiting && <p className="text-center">Waiting for players...</p>}
      {winner && <p className="text-center">Winner: {winner}</p>}
      <div className="grid grid-cols-10 gap-px mx-auto w-max">
        {cells.map((cell) => (
          <div key={cell} className="relative border border-border w-8 h-8 text-[10px] flex items-center justify-center">
            {cell}
            <div className="absolute inset-0 flex items-center justify-center space-x-1">
              {players.filter((p) => p.position === cell).map((p) => (
                <div key={p.id} className="w-3 h-3 rounded-full" style={{ background: p.color }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {currentTurn === telegramId && !winner && !waiting && (
        <div className="text-center">
          <button onClick={handleRoll} className="px-4 py-2 bg-primary text-white rounded">
            Roll Dice
          </button>
        </div>
      )}
      {dice != null && <p className="text-center">Last roll: {dice}</p>}
      <div className="text-center mt-2">
        <button onClick={() => navigate('/games/snake/lobby')} className="text-sm underline">
          Exit
        </button>
      </div>
    </div>
  );
}

