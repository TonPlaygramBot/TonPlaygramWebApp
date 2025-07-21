import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export function joinLobby(gameType, stake, accountId, name) {
  socket.emit('joinLobby', { accountId, name, gameType, stake });
}

socket.on('lobbyUpdate', ({ tableId, players }) => {
  console.log('Lobby update for', tableId, players);
});

socket.on('gameStart', ({ tableId, players, stake }) => {
  console.log('Game starting on', tableId, 'stake', stake, players);
});
