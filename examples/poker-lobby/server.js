const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const GAME_START_DELAY_MS = 1000;
const MAX_PLAYERS_PER_TABLE = 6;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// stake -> [table]
const tables = {};
// socket.id -> { stake, tableId, accountId }
const socketMap = new Map();

function cleanupTables() {
  Object.keys(tables).forEach((stake) => {
    tables[stake] = tables[stake].filter((table) => {
      if (table.players.length === 0) {
        if (table.startTimer) {
          clearTimeout(table.startTimer);
          table.startTimer = null;
        }
        return false;
      }
      return true;
    });
    if (tables[stake].length === 0) delete tables[stake];
  });
}

function createNewTable(stake) {
  const table = {
    id: crypto.randomUUID(),
    stake,
    maxPlayers: MAX_PLAYERS_PER_TABLE,
    players: [],
    startTimer: null
  };
  if (!tables[stake]) tables[stake] = [];
  tables[stake].push(table);
  console.log(`Created new table ${table.id} (stake ${stake})`);
  return table;
}

function getAvailableTable(stake) {
  if (!tables[stake]) tables[stake] = [];
  const open = tables[stake].find((t) => t.players.length < t.maxPlayers);
  return open || createNewTable(stake);
}

io.on('connection', (socket) => {
  console.log('New connection', socket.id);

  socket.on('joinLobby', ({ accountId, name, stake }) => {
    const table = getAvailableTable(stake);

    if (!table.players.find((p) => p.id === accountId)) {
      table.players.push({ id: accountId, name });
    }

    socketMap.set(socket.id, { stake, tableId: table.id, accountId });

    socket.join(table.id);
    console.log(`Player ${name} (${accountId}) joined table ${table.id}`);
    io.to(table.id).emit('lobbyUpdate', {
      tableId: table.id,
      players: table.players
    });

    if (table.players.length === table.maxPlayers && !table.startTimer) {
      console.log(`Table ${table.id} is full. Starting game soon.`);
      table.startTimer = setTimeout(() => {
        table.startTimer = null;
        io.to(table.id).emit('gameStart', {
          tableId: table.id,
          players: table.players,
          stake: table.stake
        });
      }, GAME_START_DELAY_MS);
    }
  });

  socket.on('leaveLobby', ({ accountId, stake }) => {
    (tables[stake] || []).forEach((table) => {
      table.players = table.players.filter((p) => p.id !== accountId);
      if (table.startTimer && table.players.length < table.maxPlayers) {
        clearTimeout(table.startTimer);
        table.startTimer = null;
      }
      io.to(table.id).emit('lobbyUpdate', {
        tableId: table.id,
        players: table.players
      });
    });
    socketMap.delete(socket.id);
    cleanupTables();
    console.log(`Player ${accountId} left lobby ${stake}`);
  });

  socket.on('disconnect', () => {
    const data = socketMap.get(socket.id);
    if (data) {
      const { stake, accountId } = data;
      (tables[stake] || []).forEach((table) => {
        table.players = table.players.filter((p) => p.id !== accountId);
        if (table.startTimer && table.players.length < table.maxPlayers) {
          clearTimeout(table.startTimer);
          table.startTimer = null;
        }
        io.to(table.id).emit('lobbyUpdate', {
          tableId: table.id,
          players: table.players
        });
      });
      socketMap.delete(socket.id);
      cleanupTables();
    }
    console.log('Disconnected', socket.id);
  });
});

setInterval(cleanupTables, 60_000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Poker lobby server listening on', PORT));
