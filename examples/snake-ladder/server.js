import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { Game } from './gameLogic.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const games = new Map();

function getGame(roomId) {
  if (!games.has(roomId)) {
    games.set(roomId, new Game(roomId));
  }
  return games.get(roomId);
}

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, name }) => {
    const game = getGame(roomId);
    game.addPlayer(socket.id, name || 'Player');
    socket.join(roomId);
    io.to(roomId).emit('gameStateUpdate', game.getState());
  });

  socket.on('rollDice', ({ roomId }) => {
    const game = games.get(roomId);
    if (!game) return;
    game.rollDice(socket.id);
    io.to(roomId).emit('gameStateUpdate', game.getState());
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Game server listening on port ${PORT}`);
});
