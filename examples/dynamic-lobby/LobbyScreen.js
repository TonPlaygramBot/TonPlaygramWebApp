import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const SERVER_URL = 'http://192.168.x.x:3000'; // Replace with LAN IP
const socket = io(SERVER_URL);

export default function LobbyScreen({
  gameType = '1v1',
  stake = '0.1 TON',
  playerName = 'Player'
}) {
  const [players, setPlayers] = useState([]);
  const [tableId, setTableId] = useState(null);
  const [accountId] = useState(() => uuidv4());
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    socket.emit('joinLobby', { accountId, name: playerName, gameType, stake });

    socket.on('lobbyUpdate', ({ tableId, players }) => {
      setTableId(tableId);
      setPlayers(players);
    });

    socket.on('gameStart', ({ tableId, players, stake }) => {
      setGameStarted(true);
      console.log(
        `Game starting on table ${tableId} with stake ${stake}`,
        players
      );
    });

    return () => {
      socket.off('lobbyUpdate');
      socket.off('gameStart');
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>
        Lobby: {gameType} - {stake}
      </h2>
      <p>Table ID: {tableId || 'Waiting...'}</p>
      <ul>
        {players.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
      {gameStarted ? (
        <p style={{ color: 'green' }}>Game Started!</p>
      ) : (
        <p>Waiting for players...</p>
      )}
      <button
        onClick={() =>
          socket.emit('leaveLobby', { accountId, gameType, stake })
        }
      >
        Leave Lobby
      </button>
    </div>
  );
}
