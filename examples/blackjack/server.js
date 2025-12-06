import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { BlackjackGame } from './gameLogic.js';

const MIN_PLAYERS = 2;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const games = new Map();

function getGame(roomId) {
  if (!games.has(roomId)) {
    games.set(roomId, new BlackjackGame(roomId));
  }
  return games.get(roomId);
}

function broadcastState(roomId) {
  const game = games.get(roomId);
  if (!game) return;
  io.to(roomId).emit('gameStateUpdate', game.getState());
}

function maybeStart(game) {
  if (game.phase === 'waiting' && game.players.length >= MIN_PLAYERS) {
    game.start();
  }
}

function maybeResolveRound(game, roomId) {
  if (game.phase === 'betting' && game.allPlayersCalled()) {
    game.startHitPhase();
  }

  if (game.phase === 'hit' && game.allPlayersSettled()) {
    const showdown = game.showdown();
    io.to(roomId).emit('showdown', showdown);
    game.finishRound();
  }
}

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, name }) => {
    const game = getGame(roomId);
    const player = game.addPlayer(socket.id, name || 'Player');
    if (!player) {
      socket.emit('joinRejected', { reason: 'Room full or already started' });
      return;
    }
    socket.join(roomId);
    maybeStart(game);
    broadcastState(roomId);
  });

  socket.on('bet', ({ roomId, amount }) => {
    const game = games.get(roomId);
    if (!game) return;
    game.placeBet(socket.id, amount || 0);
    maybeResolveRound(game, roomId);
    broadcastState(roomId);
  });

  socket.on('call', ({ roomId }) => {
    const game = games.get(roomId);
    if (!game) return;
    game.call(socket.id);
    maybeResolveRound(game, roomId);
    broadcastState(roomId);
  });

  socket.on('raise', ({ roomId, amount }) => {
    const game = games.get(roomId);
    if (!game) return;
    game.raise(socket.id, amount || 0);
    maybeResolveRound(game, roomId);
    broadcastState(roomId);
  });

  socket.on('fold', ({ roomId }) => {
    const game = games.get(roomId);
    if (!game) return;
    game.fold(socket.id);
    maybeResolveRound(game, roomId);
    broadcastState(roomId);
  });

  socket.on('hit', ({ roomId }) => {
    const game = games.get(roomId);
    if (!game) return;
    game.hit(socket.id);
    maybeResolveRound(game, roomId);
    broadcastState(roomId);
  });

  socket.on('stand', ({ roomId }) => {
    const game = games.get(roomId);
    if (!game) return;
    game.stand(socket.id);
    maybeResolveRound(game, roomId);
    broadcastState(roomId);
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      const game = games.get(roomId);
      if (!game) continue;
      const player = game.players.find((p) => p.id === socket.id);
      if (player) {
        player.folded = true;
        player.stood = true;
      }
      maybeResolveRound(game, roomId);
      broadcastState(roomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Blackjack server listening on port ${PORT}`);
});
