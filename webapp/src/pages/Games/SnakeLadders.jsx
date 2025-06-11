import { useState, useEffect } from 'react';
import { socket } from '../../utils/socket.js';

export default function SnakeLadders() {
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [game, setGame] = useState(null);
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState('');
  const [roomId] = useState(() => {
    const hash = window.location.hash.slice(1);
    if (hash) return hash;
    const id = Math.random().toString(36).substring(2, 8);
    window.location.hash = id;
    return id;
  });

  useEffect(() => {
    socket.on('game-state', setGame);
    socket.on('game-over', ({ winner }) => setWinner(winner));
    socket.on('error', setError);
    return () => {
      socket.off('game-state', setGame);
      socket.off('game-over');
      socket.off('error', setError);
    };
  }, []);

  const join = () => {
    if (!name) return;
    socket.emit('join-game', { roomId, name });
    setJoined(true);
  };

  const roll = () => {
    socket.emit('roll-dice', { roomId });
  };

  if (!joined) {
    return (
      <div className="p-4 space-y-2">
        <h2 className="text-xl font-bold">Join Snakes &amp; Ladders</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="border p-1 mr-2"
        />
        <button onClick={join} className="px-2 py-1 bg-blue-500 text-white rounded">
          Join
        </button>
        {error && <p className="text-red-500">{error}</p>}
        <p className="text-xs">Share this link with friends: {window.location.href}</p>
      </div>
    );
  }

  if (winner && game) {
    const winnerName = game.players.find((p) => p.id === winner)?.name || winner;
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold">Winner: {winnerName}</h2>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-xl font-bold">Snakes &amp; Ladders</h2>
      {game && (
        <>
          <div>Players: {game.players.map((p) => p.name).join(', ')}</div>
          <div>Turn: {game.players[game.turn].name}</div>
          <ul>
            {game.players.map((p) => (
              <li key={p.id}>
                {p.name}: {game.positions[p.id]}
              </li>
            ))}
          </ul>
        </>
      )}
      <button
        onClick={roll}
        className="px-2 py-1 bg-green-600 text-white rounded"
      >
        Roll Dice
      </button>
    </div>
  );
}
