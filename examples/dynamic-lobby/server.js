const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const GAME_START_DELAY_MS = 1000;
const FINAL_TILE = 101;

function generateBoard() {
  const boardSize = FINAL_TILE - 1;
  const snakeCount = 6 + Math.floor(Math.random() * 3);
  const ladderCount = 6 + Math.floor(Math.random() * 3);
  const snakes = {};
  const used = new Set();
  while (Object.keys(snakes).length < snakeCount) {
    const start = Math.floor(Math.random() * (boardSize - 10)) + 10;
    const maxDrop = Math.min(start - 1, 20);
    if (maxDrop <= 0) continue;
    const end = start - (Math.floor(Math.random() * maxDrop) + 1);
    if (used.has(start) || used.has(end) || snakes[start] || end === 1) continue;
    snakes[start] = end;
    used.add(start);
    used.add(end);
  }
  const ladders = {};
  const usedL = new Set([...used]);
  while (Object.keys(ladders).length < ladderCount) {
    const start = Math.floor(Math.random() * (boardSize - 20)) + 2;
    const max = Math.min(boardSize - start - 1, 20);
    if (max < 1) continue;
    const end = start + (Math.floor(Math.random() * max) + 1);
    if (
      usedL.has(start) ||
      usedL.has(end) ||
      ladders[start] ||
      Object.values(ladders).includes(end)
    )
      continue;
    ladders[start] = end;
    usedL.add(start);
    usedL.add(end);
  }
  return { snakes, ladders };
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const tables = {}; // key = `${gameType}-${stake}` -> array of tables

function cleanupTables() {
  Object.keys(tables).forEach((key) => {
    tables[key] = tables[key].filter((table) => {
      if (table.players.length === 0) {
        if (table.startTimer) {
          clearTimeout(table.startTimer);
          table.startTimer = null;
        }
        return false;
      }
      return true;
    });
    if (tables[key].length === 0) delete tables[key];
  });
}

function createNewTable(gameType, stake) {
  const maxPlayers = gameType === '1v1' ? 2 : gameType === '3player' ? 3 : 4;
  const table = {
    id: crypto.randomUUID(),
    gameType,
    stake,
    maxPlayers,
    players: [],
    startTimer: null
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

    if (table.players.length === table.maxPlayers && !table.startTimer) {
      console.log(`Table ${table.id} is full. Starting game soon.`);
      table.startTimer = setTimeout(() => {
        table.startTimer = null;
        const board = generateBoard();
        io.to(table.id).emit('gameStart', {
          tableId: table.id,
          players: table.players,
          stake: table.stake,
          board
        });
      }, GAME_START_DELAY_MS);
    }
  });

  socket.on('leaveLobby', ({ accountId, gameType, stake }) => {
    const key = `${gameType}-${stake}`;
    (tables[key] || []).forEach((table) => {
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
    cleanupTables();
    console.log(`Player ${accountId} left lobby ${gameType}-${stake}`);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected', socket.id);
  });
});

setInterval(cleanupTables, 60_000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Lobby server listening on', PORT));
