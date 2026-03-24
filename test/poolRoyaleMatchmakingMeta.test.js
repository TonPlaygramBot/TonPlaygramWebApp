import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import { io } from 'socket.io-client';

const distDir = new URL('../webapp/dist/', import.meta.url);
const apiToken = 'test-token';

async function startServer(env) {
  const server = spawn('node', ['bot/server.js'], { env, stdio: 'pipe' });
  await new Promise((resolve) => {
    const onData = (chunk) => {
      if (chunk.toString().includes('Server running on port')) {
        server.stdout.off('data', onData);
        resolve();
      }
    };
    server.stdout.on('data', onData);
  });
  return server;
}

function connectClient(port) {
  return io(`http://localhost:${port}`, { auth: { token: apiToken } });
}

test('pool royale players with partially-filled matching meta share same table', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3207',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    API_AUTH_TOKEN: apiToken,
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };

  const server = await startServer(env);
  const s1 = connectClient(3207);
  const s2 = connectClient(3207);

  try {
    await Promise.all([
      new Promise((resolve) => s1.on('connect', resolve)),
      new Promise((resolve) => s2.on('connect', resolve))
    ]);

    s1.emit('register', { playerId: 'acct-1' });
    s2.emit('register', { playerId: 'acct-2' });

    const firstSeat = await new Promise((resolve) => {
      s1.emit('seatTable', {
        accountId: 'acct-1',
        gameType: 'poolroyale',
        stake: 100,
        maxPlayers: 2,
        mode: 'online',
        playType: 'regular',
        playerName: 'P1'
      }, resolve);
    });

    const secondSeat = await new Promise((resolve) => {
      s2.emit('seatTable', {
        accountId: 'acct-2',
        gameType: 'poolroyale',
        stake: 100,
        maxPlayers: 2,
        mode: 'online',
        playType: 'regular',
        tableSize: 'pro',
        playerName: 'P2'
      }, resolve);
    });

    assert.equal(firstSeat.success, true);
    assert.equal(secondSeat.success, true);
    assert.equal(secondSeat.tableId, firstSeat.tableId);
    assert.equal(secondSeat.players.length, 2);
  } finally {
    s1.disconnect();
    s2.disconnect();
    server.kill();
  }
});

test('pool royale players using variant aliases still share a table', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3210',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    API_AUTH_TOKEN: apiToken,
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };

  const server = await startServer(env);
  const s1 = connectClient(3210);
  const s2 = connectClient(3210);

  try {
    await Promise.all([
      new Promise((resolve) => s1.on('connect', resolve)),
      new Promise((resolve) => s2.on('connect', resolve))
    ]);

    s1.emit('register', { playerId: 'acct-variant-1' });
    s2.emit('register', { playerId: 'acct-variant-2' });

    const firstSeat = await new Promise((resolve) => {
      s1.emit(
        'seatTable',
        {
          accountId: 'acct-variant-1',
          gameType: 'poolroyale',
          stake: 250,
          maxPlayers: 2,
          mode: 'online',
          variant: '8-ball',
          playerName: 'VariantA'
        },
        resolve
      );
    });

    const secondSeat = await new Promise((resolve) => {
      s2.emit(
        'seatTable',
        {
          accountId: 'acct-variant-2',
          gameType: 'poolroyale',
          stake: 250,
          maxPlayers: 2,
          mode: 'online',
          variant: 'eightball',
          playerName: 'VariantB'
        },
        resolve
      );
    });

    assert.equal(firstSeat.success, true);
    assert.equal(secondSeat.success, true);
    assert.equal(secondSeat.tableId, firstSeat.tableId);
    assert.equal(secondSeat.players.length, 2);
  } finally {
    s1.disconnect();
    s2.disconnect();
    server.kill();
  }
});

test('pool royale quick matchmaking ignores non-variant metadata when stake+variant match', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3211',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    API_AUTH_TOKEN: apiToken,
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };

  const server = await startServer(env);
  const s1 = connectClient(3211);
  const s2 = connectClient(3211);

  try {
    await Promise.all([
      new Promise((resolve) => s1.on('connect', resolve)),
      new Promise((resolve) => s2.on('connect', resolve))
    ]);

    s1.emit('register', { playerId: 'acct-meta-1' });
    s2.emit('register', { playerId: 'acct-meta-2' });

    const firstSeat = await new Promise((resolve) => {
      s1.emit(
        'seatTable',
        {
          accountId: 'acct-meta-1',
          gameType: 'poolroyale',
          stake: 500,
          maxPlayers: 2,
          mode: 'ranked',
          playType: 'duel',
          tableSize: '9ft',
          ballSet: 'american',
          variant: '8ball',
          playerName: 'MetaA'
        },
        resolve
      );
    });

    const secondSeat = await new Promise((resolve) => {
      s2.emit(
        'seatTable',
        {
          accountId: 'acct-meta-2',
          gameType: 'poolroyale',
          stake: 500,
          maxPlayers: 2,
          mode: 'casual',
          playType: 'quick',
          tableSize: 'pro',
          ballSet: 'uk',
          variant: 'eightball',
          playerName: 'MetaB'
        },
        resolve
      );
    });

    assert.equal(firstSeat.success, true);
    assert.equal(secondSeat.success, true);
    assert.equal(secondSeat.tableId, firstSeat.tableId);
    assert.equal(secondSeat.players.length, 2);
  } finally {
    s1.disconnect();
    s2.disconnect();
    server.kill();
  }
});

test('pool royale disconnect clears stale lobby seat so next player can queue cleanly', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3208',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    API_AUTH_TOKEN: apiToken,
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };

  const server = await startServer(env);
  const s1 = connectClient(3208);

  try {
    await new Promise((resolve) => s1.on('connect', resolve));
    s1.emit('register', { playerId: 'acct-disconnect-a' });

    const firstSeat = await new Promise((resolve) => {
      s1.emit(
        'seatTable',
        {
          accountId: 'acct-disconnect-a',
          gameType: 'poolroyale',
          stake: 100,
          maxPlayers: 2,
          mode: 'online',
          playType: 'regular',
          playerName: 'DisconnectA'
        },
        resolve
      );
    });
    assert.equal(firstSeat.success, true);
    assert.equal(firstSeat.players.length, 1);

    s1.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));

    const s2 = connectClient(3208);
    try {
      await new Promise((resolve) => s2.on('connect', resolve));
      s2.emit('register', { playerId: 'acct-disconnect-b' });
      const secondSeat = await new Promise((resolve) => {
        s2.emit(
          'seatTable',
          {
            accountId: 'acct-disconnect-b',
            gameType: 'poolroyale',
            stake: 100,
            maxPlayers: 2,
            mode: 'online',
            playType: 'regular',
            playerName: 'DisconnectB'
          },
          resolve
        );
      });

      assert.equal(secondSeat.success, true);
      assert.equal(
        secondSeat.players.some((player) => player.id === 'acct-disconnect-a'),
        false
      );
      assert.equal(secondSeat.players.length, 1);
    } finally {
      s2.disconnect();
    }
  } finally {
    server.kill();
  }
});

test('pool royale allows joining the same explicit tableId when id is not game-prefixed', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3209',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    API_AUTH_TOKEN: apiToken,
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };

  const server = await startServer(env);
  const s1 = connectClient(3209);
  const s2 = connectClient(3209);
  const sharedTableId = 'room-77';

  try {
    await Promise.all([
      new Promise((resolve) => s1.on('connect', resolve)),
      new Promise((resolve) => s2.on('connect', resolve))
    ]);

    s1.emit('register', { playerId: 'acct-room-a' });
    s2.emit('register', { playerId: 'acct-room-b' });

    const firstSeat = await new Promise((resolve) => {
      s1.emit(
        'seatTable',
        {
          accountId: 'acct-room-a',
          gameType: 'poolroyale',
          stake: 100,
          maxPlayers: 2,
          mode: 'online',
          playType: 'regular',
          tableId: sharedTableId,
          playerName: 'RoomA'
        },
        resolve
      );
    });

    const secondSeat = await new Promise((resolve) => {
      s2.emit(
        'seatTable',
        {
          accountId: 'acct-room-b',
          gameType: 'poolroyale',
          stake: 100,
          maxPlayers: 2,
          mode: 'online',
          playType: 'regular',
          tableId: sharedTableId,
          playerName: 'RoomB'
        },
        resolve
      );
    });

    assert.equal(firstSeat.success, true);
    assert.equal(firstSeat.tableId, sharedTableId);
    assert.equal(secondSeat.success, true);
    assert.equal(secondSeat.tableId, sharedTableId);
    assert.equal(secondSeat.players.length, 2);
  } finally {
    s1.disconnect();
    s2.disconnect();
    server.kill();
  }
});

test('pool royale canonicalizes table size aliases so equivalent criteria can still match', { concurrency: false, timeout: 20000 }, async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3210',
    MONGO_URI: 'memory',
    BOT_TOKEN: 'dummy',
    API_AUTH_TOKEN: apiToken,
    SKIP_WEBAPP_BUILD: '1',
    SKIP_BOT_LAUNCH: '1'
  };

  const server = await startServer(env);
  const s1 = connectClient(3210);
  const s2 = connectClient(3210);

  try {
    await Promise.all([
      new Promise((resolve) => s1.on('connect', resolve)),
      new Promise((resolve) => s2.on('connect', resolve))
    ]);

    s1.emit('register', { playerId: 'acct-size-a' });
    s2.emit('register', { playerId: 'acct-size-b' });

    const firstSeat = await new Promise((resolve) => {
      s1.emit(
        'seatTable',
        {
          accountId: 'acct-size-a',
          gameType: 'poolroyale',
          stake: 100,
          maxPlayers: 2,
          mode: 'online',
          playType: 'regular',
          tableSize: '9 ft (Tournament)',
          playerName: 'SizeA'
        },
        resolve
      );
    });

    const secondSeat = await new Promise((resolve) => {
      s2.emit(
        'seatTable',
        {
          accountId: 'acct-size-b',
          gameType: 'poolroyale',
          stake: 100,
          maxPlayers: 2,
          mode: 'online',
          playType: 'regular',
          tableSize: 'pro',
          playerName: 'SizeB'
        },
        resolve
      );
    });

    assert.equal(firstSeat.success, true);
    assert.equal(secondSeat.success, true);
    assert.equal(secondSeat.tableId, firstSeat.tableId);
    assert.equal(secondSeat.players.length, 2);
  } finally {
    s1.disconnect();
    s2.disconnect();
    server.kill();
  }
});
