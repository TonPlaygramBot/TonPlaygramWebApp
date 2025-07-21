const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const tables = {}; // key = `${gameType}-${stake}` -> array of tables

function createNewTable(gameType, stake) {
  const maxPlayers = gameType === '1v1' ? 2 : gameType === '3player' ? 3 : 4;
  const table = {
    id: crypto.randomUUID(),
    gameType,
    stake,
    maxPlayers,
    players: []
  };
  const key = `${gameType}-${stake}`;
  if (!tables[key]) tables[key] = [];
  tables[key].push(table);
  console.log(`Created new table: ${table.id} (${gameType}, stake: ${stake})`);
  return table;
}

function getAvailableTable(gameType, stake) {
  const key = `${gameType}-${stake}`;
  if (!tables[key]) tables[key] = [];
  const open = tables[key].find((t) => t.players.length < t.maxPlayers);
  return open || createNewTable(gameType, stake);
}

io.on('connection', (socket) => {
  console.log('New connection', socket.id);

  socket.on('joinLobby', ({ accountId, name, gameType, stake }) => {
    const table = getAvailableTable(gameType, stake);

    if (!table.players.find((p) => p.id === accountId)) {
      table.players.push({ id: accountId, name });
    }

    socket.join(table.id);
    console.log(`Player ${name} (${accountId}) joined table ${table.id}`);
    io.to(table.id).emit('lobbyUpdate', {
      tableId: table.id,
      players: table.players
    });

    if (table.players.length === table.maxPlayers) {
      console.log(`Table ${table.id} is full. Starting game.`);
      io.to(table.id).emit('gameStart', {
        tableId: table.id,
        players: table.players,
        stake: table.stake
      });
    }
  });

  socket.on('leaveLobby', ({ accountId, gameType, stake }) => {
    const key = `${gameType}-${stake}`;
    (tables[key] || []).forEach((table) => {
      table.players = table.players.filter((p) => p.id !== accountId);
      io.to(table.id).emit('lobbyUpdate', {
        tableId: table.id,
        players: table.players
      });
    });
    console.log(`Player ${accountId} left lobby ${gameType}-${stake}`);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Lobby server listening on', PORT));
