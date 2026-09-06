import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { createTiranaStreets } from '../bot/services/tiranaStreets.js';
import {
  freshCareer,
  awardCareer
} from '../webapp/src/games/tiranastreets/shared/engine.mjs';

test(
  'two real Socket.IO clients join, ready, drive, resume and clean up one authoritative room',
  { timeout: 12000 },
  async (t) => {
    const server = http.createServer(),
      io = new Server(server, { transports: ['websocket'] }),
      saved = new Map();
    const service = createTiranaStreets({
      career: {
        load: async (id) => saved.get(id) || freshCareer(),
        complete: async (id, s, p) => {
          const c = awardCareer(saved.get(id) || freshCareer(), s, p);
          saved.set(id, c);
          return c;
        }
      }
    });
    io.use((s, next) => {
      s.data.playerId = s.handshake.auth.accountId;
      s.data.auth = { accountId: s.data.playerId };
      next();
    });
    io.on('connection', (s) => service.attach(s));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`,
      clients = [];
    t.after(async () => {
      clients.forEach((s) => s.disconnect());
      service.close();
      await new Promise((resolve) => io.close(resolve));
    });
    async function connect(id) {
      const socket = client(url, {
        transports: ['websocket'],
        auth: { accountId: id },
        reconnection: false
      });
      clients.push(socket);
      await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      });
      return socket;
    }
    async function ask(s, action, payload = {}) {
      return new Promise((resolve, reject) =>
        s
          .timeout(2000)
          .emit(
            'tirana:request',
            { accountId: s.auth.accountId, action, ...payload },
            (err, r) => {
              if (err) return reject(err);
              r.success ? resolve(r.data) : reject(Error(r.error));
            }
          )
      );
    }
    const a = await connect('socket-a'),
      b = await connect('socket-b');
    const created = await ask(a, 'create', {
        mode: 'coop',
        missionId: 'first-shift'
      }),
      roomId = created.room.id;
    await ask(b, 'join', { roomId });
    await ask(b, 'ready', { roomId, ready: true });
    await ask(a, 'start', { roomId });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const entered = await ask(a, 'input', {
      roomId,
      input: { seq: 1, y: 0 },
      interaction: 'vehicle',
      actionSeq: 1
    });
    const playerId = entered.room.playerId;
    assert.ok(entered.room.state.players[playerId].carId);
    const start = entered.room.state.players[playerId];
    for (let i = 2; i <= 6; i++) {
      await ask(a, 'input', { roomId, input: { seq: i, y: 1 } });
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    const peer = await ask(b, 'input', { roomId, input: { seq: 1 } }),
      moved = peer.room.state.players[playerId];
    assert.ok(
      Math.hypot(moved.x - start.x, moved.z - start.z) > 0.2,
      'peer sees authoritative vehicle movement'
    );
    a.disconnect();
    const resumed = await connect('socket-a');
    const joined = await ask(resumed, 'join', { roomId });
    assert.equal(joined.room.playerId, playerId);
    assert.equal(joined.room.members.length, 2);
    await ask(resumed, 'input', {
      roomId,
      input: { seq: 1 },
      interaction: 'recover',
      actionSeq: 1
    });
    await ask(b, 'leave', { roomId });
    const profile = await ask(b, 'profile');
    assert.equal(profile.activeRoom, null);
    const remaining = await ask(resumed, 'input', {
      roomId,
      input: { seq: 2 }
    });
    assert.equal(remaining.room.members.length, 1);
    await ask(resumed, 'leave', { roomId });
  }
);
