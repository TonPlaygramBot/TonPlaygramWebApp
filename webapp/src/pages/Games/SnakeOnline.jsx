import { useMemo } from 'react';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import useSnakeRoom from '../../hooks/useSnakeRoom.js';

const ROWS = 20;
const COLS = 5;

function SimpleBoard({ players, snakes, ladders }) {
  const tiles = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    const reversed = r % 2 === 1;
    for (let c = 0; c < COLS; c++) {
      const num = r * COLS + (reversed ? COLS - c : c + 1);
      tiles.push(
        <div key={num} className="w-8 h-8 border relative text-[10px]">
          <span className="absolute top-0 left-0">{num}</span>
          {snakes[num] && <span className="absolute bottom-0 left-0 text-red-500">S</span>}
          {ladders[num] && <span className="absolute bottom-0 right-0 text-green-500">L</span>}
          {players
            .filter((p) => p.position === num)
            .map((p) => (
              <span
                key={p.id}
                className="absolute inset-0 flex items-center justify-center text-xl"
                style={{ color: p.color }}
              >
                ●
              </span>
            ))}
        </div>
      );
    }
  }
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${COLS}, 2rem)` }}
    >
      {tiles}
    </div>
  );
}

export default function SnakeOnline() {
  useTelegramBackButton();
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('table') || 'snake-4';
  const {
    players: playerMap,
    currentTurn,
    snakes,
    ladders,
    dice,
    winner,
    error,
    playerId,
    rollDice,
  } = useSnakeRoom(roomId);

  const players = useMemo(() => Object.entries(playerMap).map(([id, p]) => ({ id, ...p })), [playerMap]);

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">Multiplayer Snake &amp; Ladder</h2>
      {error && <div className="text-red-500">{error}</div>}
      <div>Room: {roomId}</div>
      <SimpleBoard players={players} snakes={snakes} ladders={ladders} />
      {winner ? (
        <div className="font-semibold">Winner: {playerMap[winner]?.name}</div>
      ) : (
        <div className="space-y-2">
          <div>Current turn: {playerMap[currentTurn]?.name}</div>
          {dice && <div>Dice rolled: {dice.value}</div>}
          {currentTurn === playerId && (
            <button
              onClick={rollDice}
              className="px-4 py-2 bg-primary text-white rounded"
            >
              Roll Dice
            </button>
          )}
        </div>
      )}
    </div>
  );
}
