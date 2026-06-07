import { jest, test, expect } from '@jest/globals';
import fs from 'fs';
import { spawn } from 'child_process';
import { io } from 'socket.io-client';

jest.setTimeout(30000);

const distDir = new URL('../webapp/dist/', import.meta.url);
const apiToken = 'test-token';

async function startServer(port) {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');
  const server = spawn('node', ['bot/server.js'], {
    env: {
      ...process.env,
      PORT: String(port),
      MONGO_URI: 'memory',
      BOT_TOKEN: 'dummy',
      API_AUTH_TOKEN: apiToken,
      SKIP_WEBAPP_BUILD: '1',
      SKIP_BOT_LAUNCH: '1'
    },
    stdio: 'pipe'
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server_start_timeout')), 15000);
    server.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Server running on port')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on('data', (chunk) => {
      if (/EADDRINUSE|Error/i.test(chunk.toString())) {
        clearTimeout(timer);
        reject(new Error(chunk.toString()));
      }
    });
  });
  return server;
}

function connectClient(port) {
  return io(`http://localhost:${port}`, { auth: { token: apiToken } });
}

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

test('Domino Royal lobby seats 3 online players and relays table state', async () => {
  const port = 3227;
  const server = await startServer(port);
  const clients = [connectClient(port), connectClient(port), connectClient(port)];

  try {
    await Promise.all(clients.map((client) => once(client, 'connect')));
    clients.forEach((client, index) => {
      client.emit('register', { playerId: `domino-acct-${index + 1}` });
    });

    const seats = [];
    for (let index = 0; index < clients.length; index += 1) {
      const seat = await new Promise((resolve) => {
        clients[index].emit('seatTable', {
          accountId: `domino-acct-${index + 1}`,
          gameType: 'domino-royal',
          stake: 100,
          maxPlayers: 3,
          playerName: `Domino ${index + 1}`,
          mode: 'online',
          playType: 'points',
          token: 'TPC'
        }, resolve);
      });
      seats.push(seat);
    }

    expect(seats.every((seat) => seat.success)).toBe(true);
    expect(new Set(seats.map((seat) => seat.tableId)).size).toBe(1);
    expect(seats[2].players).toHaveLength(3);

    const starts = clients.map((client) => once(client, 'gameStart'));
    clients.forEach((client, index) => {
      client.emit('confirmReady', {
        accountId: `domino-acct-${index + 1}`,
        tableId: seats[0].tableId
      });
    });
    const started = await Promise.all(starts);
    expect(started[0].players).toHaveLength(3);
    expect(started[0].meta).toMatchObject({ mode: 'online', playType: 'points', token: 'tpc' });

    clients.forEach((client, index) => {
      client.emit('joinDominoTable', {
        accountId: `domino-acct-${index + 1}`,
        tableId: seats[0].tableId
      });
    });

    const receivedState = once(clients[1], 'dominoState');
    clients[0].emit('dominoAction', {
      tableId: seats[0].tableId,
      action: { type: 'start', playerId: 'domino-acct-1' },
      state: { seq: 1, current: 0, players: [{ hand: [{ a: 6, b: 6 }] }] }
    });
    const payload = await receivedState;
    expect(payload.tableId).toBe(seats[0].tableId);
    expect(payload.state.players[0].hand[0]).toEqual({ a: 6, b: 6 });
  } finally {
    clients.forEach((client) => client.disconnect());
    server.kill();
  }
});
