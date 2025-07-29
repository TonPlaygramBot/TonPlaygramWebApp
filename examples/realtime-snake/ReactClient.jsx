import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export default function ReactClient({
  roomId = 'room1',
  playerName = 'Player'
}) {
  const [state, setState] = useState(null);

  useEffect(() => {
    socket.emit('joinRoom', { roomId, name: playerName });
    socket.on('gameStateUpdate', (game) => setState(game));
    return () => {
      socket.off('gameStateUpdate');
    };
  }, [roomId, playerName]);

  const rollDice = () => socket.emit('rollDice', { roomId });

  if (!state) return <div>Loading...</div>;

  const me = socket.id;
  const current = state.players[state.currentPlayer]?.id;

  return (
    <div>
      <h3>Room: {state.roomId}</h3>
      <p>Current Player: {current}</p>
      <p>Last Dice Roll: {state.diceRoll}</p>
      <ul>
        {state.players.map((p) => (
          <li key={p.id}>
            {p.name}: {p.position}
          </li>
        ))}
      </ul>
      <button onClick={rollDice} disabled={me !== current || state.winner}>
        Roll Dice
      </button>
      {state.winner && <p>Winner: {state.winner}</p>}
    </div>
  );
}
