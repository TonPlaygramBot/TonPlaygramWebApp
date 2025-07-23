import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

export function createLobbyClient(
  serverUrl = process.env.SERVER_URL || 'http://localhost:3000'
) {
  const socket = io(serverUrl);

  function joinLobby(
    gameType,
    stake,
    accountId = uuidv4(),
    name = 'Player'
  ) {
    socket.emit('joinLobby', { accountId, name, gameType, stake });
    return accountId;
  }

  socket.on('lobbyUpdate', ({ tableId, players }) => {
    console.log('Lobby update for', tableId, players);
  });

  socket.on('gameStart', ({ tableId, players, stake }) => {
    console.log('Game starting on', tableId, 'stake', stake, players);
  });

  return { joinLobby, socket };
}
