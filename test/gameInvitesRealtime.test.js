import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const distDir = new URL('../webapp/dist/', import.meta.url);

function event(socket, name, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${name} timed out`)), timeout);
    socket.once(name, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function ack(socket, name, payload) {
  return new Promise((resolve) => socket.emit(name, payload, resolve));
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('an offline invitee receives the real-time invite on registration and accepts the hosted table', { timeout: 30000 }, async () => {
  const port = await freePort();
  const apiToken = 'game-invite-test-token';
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
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const logs = [];
  server.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  server.stderr.on('data', (chunk) => logs.push(chunk.toString()));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(logs.join(''))), 10000);
    server.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Server running on port')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  const inviter = io(`http://127.0.0.1:${port}`, { auth: { token: apiToken }, forceNew: true });
  let invitee;
  try {
    await event(inviter, 'connect');
    assert.equal((await ack(inviter, 'register', { playerId: 'player-one' })).success, true);
    const roomId = 'invite-player-one-player-two-123-2';
    const sent = await ack(inviter, 'invite1v1', {
      fromId: 'player-one',
      fromName: 'Player One',
      toId: 'player-two',
      roomId,
      token: 'TPG',
      amount: 100,
      game: 'poolroyale'
    });
    assert.equal(sent.success, true);

    invitee = io(`http://127.0.0.1:${port}`, { auth: { token: apiToken }, forceNew: true });
    await event(invitee, 'connect');
    const receivedPromise = event(invitee, 'gameInvite');
    assert.equal((await ack(invitee, 'register', { playerId: 'player-two' })).success, true);
    const received = await receivedPromise;
    assert.equal(received.roomId, roomId);
    assert.equal(received.game, 'poolroyale');

    const acceptedEvent = event(inviter, 'gameInviteAccepted');
    const accepted = await ack(invitee, 'gameInvite:accept', { roomId });
    assert.equal(accepted.success, true);
    assert.equal(accepted.invite.roomId, roomId);
    assert.equal((await acceptedEvent).roomId, roomId);
  } finally {
    inviter.disconnect();
    invitee?.disconnect();
    server.kill('SIGTERM');
  }
});
