import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { createTennisRoyal } from '../bot/services/tennisRoyal.js';
import {
  createMemoryUser,
  findMemoryUser
} from '../bot/utils/memoryUserStore.js';
import { neutralInput } from '../shared/tennis/engine.js';
process.env.MONGO_URI = 'memory';
const ack = (socket, event, payload) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(`${event} timed out`)), 3000);
    socket.emit(event, payload, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
test(
  'two Socket.IO clients join one tennis match, exchange state and settle retirement once',
  { timeout: 12000 },
  async () => {
    const server = http.createServer(),
      io = new Server(server);
    const ids = ['wire-a', 'wire-b'];
    ids.forEach((accountId) => createMemoryUser({ accountId, balance: 1000 }));
    const table = {
      id: 'wire-match',
      players: ids.map((id) => ({ id, name: id })),
      stake: 100,
      meta: { surface: 'grass', format: 'quick' },
      ready: new Set(ids)
    };
    const service = createTennisRoyal({
      io,
      tableMap: new Map([[table.id, table]])
    });
    const clients = [];
    try {
      await service.prepare(table);
      io.use((socket, next) => {
        socket.data.playerId = socket.handshake.auth.accountId;
        socket.data.auth = { accountId: socket.data.playerId };
        next();
      });
      io.on('connection', service.attach);
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = server.address().port;
      for (const accountId of ids) {
        const socket = connect(`http://127.0.0.1:${port}`, {
          auth: { accountId },
          transports: ['websocket'],
          forceNew: true
        });
        clients.push(socket);
        await new Promise((resolve, reject) => {
          socket.once('connect', resolve);
          socket.once('connect_error', reject);
        });
      }
      for (let i = 0; i < 2; i++) {
        const joined = await ack(clients[i], 'tennisJoin', {
          tableId: table.id,
          accountId: ids[i]
        });
        assert.equal(joined.data.seat, i);
      }
      await ack(clients[0], 'tennisInput', {
        tableId: table.id,
        accountId: ids[0],
        input: { ...neutralInput(), swing: 1 }
      });
      await new Promise((resolve) => setTimeout(resolve, 800));
      const states = await Promise.all(
        clients.map((s, i) =>
          ack(s, 'tennisInput', {
            tableId: table.id,
            accountId: ids[i],
            input: { ...neutralInput(), swing: i === 0 ? 1 : 0 }
          })
        )
      );
      assert.ok(
        states.every(
          (s) =>
            s.success &&
            s.data.state.time > 0.6 &&
            s.data.state.config.surface === 'grass'
        )
      );
      assert.deepEqual(states[0].data.state.score, states[1].data.state.score);
      const retired = await ack(clients[0], 'tennisLeave', {
        tableId: table.id,
        accountId: ids[0]
      });
      assert.equal(retired.success, true);
      const result = await ack(clients[1], 'tennisInput', {
        tableId: table.id,
        accountId: ids[1],
        input: neutralInput()
      });
      assert.equal(result.data.state.winner, 1);
      assert.equal(findMemoryUser({ accountId: ids[1] }).balance, 1100);
    } finally {
      clients.forEach((c) => c.disconnect());
      service.close();
      await new Promise((resolve) => io.close(resolve));
      if (server.listening)
        await new Promise((resolve) => server.close(resolve));
    }
  }
);
