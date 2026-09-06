import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { createBowlingRoyal } from '../bot/services/bowlingRoyal.js';
import {
  createMemoryUser,
  findMemoryUser
} from '../bot/utils/memoryUserStore.js';
process.env.MONGO_URI = 'memory';
const ack = (s, event, p) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(event + ' timeout')), 3000);
    s.emit(event, p, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
test(
  'real Socket.IO clients share a bowling match, resume on a new socket, and settle once',
  { timeout: 15000 },
  async () => {
    const server = http.createServer(),
      io = new Server(server),
      clients = [];
    const ids = ['bowling-wire-a', 'bowling-wire-b'];
    ids.forEach((accountId) => createMemoryUser({ accountId, balance: 1000 }));
    const table = {
      id: 'bowling-wire',
      gameType: 'bowlingroyal',
      players: ids.map((id) => ({ id })),
      ready: new Set(ids),
      stake: 100,
      meta: { format: 'tenpin', mode: 'online', token: 'TPG' }
    };
    // prepare() in this isolated transport test uses the supplied immutable ready roster.
    const service = createBowlingRoyal({
      io: {},
      tableMap: new Map([[table.id, table]])
    });
    try {
      await service.prepare(table);
      io.use((s, next) => {
        s.data.playerId = s.handshake.auth.accountId;
        s.data.auth = { accountId: s.data.playerId };
        next();
      });
      io.on('connection', service.attach);
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      const url = `http://127.0.0.1:${server.address().port}`;
      async function client(id) {
        const s = connect(url, {
          auth: { accountId: id },
          transports: ['websocket'],
          forceNew: true
        });
        clients.push(s);
        await new Promise((r, j) => {
          s.once('connect', r);
          s.once('connect_error', j);
        });
        return s;
      }
      const a = await client(ids[0]),
        b = await client(ids[1]);
      const payload = (i) => ({ tableId: table.id, accountId: ids[i] });
      for (const [i, s] of [a, b].entries())
        assert.equal((await ack(s, 'bowlingJoin', payload(i))).data.seat, i);
      const input = { power: 0.85, releaseX: 0.2, targetX: 0.16, hook: 0 };
      assert.equal(
        (await ack(a, 'bowlingThrow', { ...payload(0), turn: 1, input }))
          .success,
        true
      );
      await new Promise((r) => setTimeout(r, 1400));
      const sa = (await ack(a, 'bowlingSync', payload(0))).data,
        sb = (await ack(b, 'bowlingSync', payload(1))).data;
      assert.equal(sa.state.phase, 'rolling');
      assert.equal(sb.state.turn, sa.state.turn);
      assert.deepEqual(sb.state.players, sa.state.players);
      const resumed = await client(ids[0]);
      assert.equal(
        (await ack(resumed, 'bowlingJoin', payload(0))).data.seat,
        0
      );
      a.disconnect();
      assert.equal(
        (await ack(resumed, 'bowlingSync', payload(0))).success,
        true
      );
      await ack(resumed, 'bowlingLeave', payload(0));
      await ack(resumed, 'bowlingLeave', payload(0));
      const result = (await ack(b, 'bowlingSync', payload(1))).data;
      assert.equal(result.state.winner, 1);
      assert.equal(result.settlement.status, 'finished');
      assert.equal(findMemoryUser({ accountId: ids[1] }).balance, 1100);
    } finally {
      clients.forEach((s) => s.disconnect());
      service.close();
      await new Promise((r) => io.close(r));
      if (server.listening) await new Promise((r) => server.close(r));
    }
  }
);
