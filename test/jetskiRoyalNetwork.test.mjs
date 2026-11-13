import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { attachJetskiRoyal } from '../bot/services/jetskiRoyal.js';
import { aiInput, sample } from '../webapp/src/games/jetski/simulation.mjs';

test('real sockets: lobby, host/ready rules, authority, reconnect, finish and rematch', async (t) => {
  let now = 100000;
  const http = createServer(),
    io = new Server(http),
    game = attachJetskiRoyal(io, { clock: () => now, automatic: false });
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${http.address().port}`,
    clients = [];
  const connect = async () => {
    const s = client(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });
    clients.push(s);
    await new Promise((res, rej) => {
      s.once('connect', res);
      s.once('connect_error', rej);
    });
    return s;
  };
  t.after(async () => {
    clients.forEach((s) => s.disconnect());
    game.close();
    await new Promise((r) => io.close(r));
  });
  const a = await connect(),
    b = await connect(),
    attacker = await connect();
  const call = (s, event, data = {}) =>
    new Promise((res, rej) =>
      s
        .timeout(1000)
        .emit(`jetski:${event}`, data, (e, r) => (e ? rej(e) : res(r)))
    );
  const tick = (n) => {
    for (let i = 0; i < n; i++) {
      now += 1000 / 60;
      game.tick();
    }
  };
  const host = await call(a, 'create', {
    trackId: 'ksamil',
    name: 'Alice',
    craftId: 'surge'
  });
  assert.equal(host.ok, true);
  const join = await call(b, 'join', { code: host.code, name: 'Bob' });
  assert.equal(join.ok, true);
  let state = (await call(a, 'sync')).state;
  assert.equal(state.players.length, 2);
  assert.ok(state.players.every((p) => !p.token && !p.socketId));
  assert.equal((await call(b, 'start')).ok, false);
  assert.equal((await call(a, 'start')).ok, false);
  await call(a, 'ready', { ready: true });
  await call(b, 'ready', { ready: true });
  now += 200;
  assert.equal((await call(a, 'start')).ok, true);
  state = (await call(b, 'sync')).state;
  assert.equal(state.status, 'countdown');
  assert.equal(state.racers.length, 6);
  const room = game.rooms.get(host.code);
  tick(301);
  a.emit('jetski:input', {
    throttle: true,
    steer: 1e10,
    x: 99999,
    finished: true,
    finishTime: 1
  });
  now += 200;
  await call(a, 'sync');
  const racer = room.racers.find((r) => r.id === host.playerId);
  assert.equal(racer.input.steer, 1);
  assert.equal(racer.finished, false);
  assert.notEqual(racer.x, 99999);
  tick(60);
  assert.equal(racer.input.throttle, false, 'stale throttle is cleared');
  now += 1000;
  assert.equal(
    (
      await call(attacker, 'resume', {
        code: host.code,
        playerId: host.playerId,
        token: 'f'.repeat(48)
      })
    ).ok,
    false
  );
  a.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(room.players[0].connected, false);
  const replacement = await connect();
  now += 1000;
  assert.equal(
    (
      await call(replacement, 'resume', {
        code: host.code,
        playerId: host.playerId,
        token: host.token
      })
    ).ok,
    true
  );
  assert.equal(room.players[0].connected, true);
  // Server receives controls only; two actual clients drive through the course using the test driver.
  for (let batch = 0; batch < 1600 && room.status !== 'finished'; batch++) {
    for (const [s, id] of [
      [replacement, host.playerId],
      [b, join.playerId]
    ]) {
      const r = room.racers.find((v) => v.id === id);
      s.emit('jetski:input', aiInput(r, room.track, 'club'));
    }
    now += 100;
    await call(b, 'sync');
    game.tick();
  }
  assert.equal(room.status, 'finished');
  state = (await call(replacement, 'sync')).state;
  assert.ok(state.results.some((r) => r.id === host.playerId && r.finished));
  assert.ok(state.results.every((r) => !('input' in r)));
  now += 200;
  assert.equal((await call(b, 'rematch')).ok, false);
  assert.equal((await call(replacement, 'rematch')).ok, true);
  assert.equal(room.status, 'waiting');
  assert.ok(room.players.every((p) => !p.ready));
  now += 1000;
  await call(replacement, 'leave');
  assert.equal(room.hostId, join.playerId);
  await call(b, 'leave');
  assert.equal(game.rooms.size, 0);

  now += 1000;
  const river = await call(replacement, 'create', { trackId: 'lana' });
  assert.equal(river.state.trackId, 'lana');
  assert.equal((await call(b, 'join', { code: river.code })).ok, true);
  await call(replacement, 'ready', { ready: true });
  await call(b, 'ready', { ready: true });
  assert.equal((await call(replacement, 'start')).ok, true);
  tick(305);
  const riverRoom = game.rooms.get(river.code);
  const riverRider = riverRoom.racers.find((r) => r.id === river.playerId);
  const edge = sample(riverRoom.track, 44, riverRoom.track.width - 0.1);
  riverRider.x = edge.x;
  riverRider.z = edge.z;
  riverRider.heading = edge.heading + Math.PI / 2;
  riverRider.vx = Math.sin(riverRider.heading) * 24;
  riverRider.vz = Math.cos(riverRider.heading) * 24;
  tick(2);
  const remoteRider = (await call(b, 'sync')).state.racers.find(
    (r) => r.id === river.playerId
  );
  assert.equal(remoteRider.crashes, 1);
  assert.ok(remoteRider.crash && Number.isFinite(remoteRider.crash.height));
  assert.ok(!('input' in remoteRider));
  tick(180);
  assert.equal(
    (await call(b, 'sync')).state.racers.find((r) => r.id === river.playerId)
      .crash,
    null
  );
});
