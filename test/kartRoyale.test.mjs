import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { attachKartRoyale } from '../bot/services/kartRoyale.js';
import {
  makeTrack,
  createRacer,
  stepRace,
  stepRacer,
  aiInput,
  STEP,
  TRACKS
} from '../webapp/src/games/kartroyale/simulation.mjs';
test('all AI drivers complete three ordered laps on all circuits and difficulties', () => {
  for (const t of TRACKS)
    for (const d of ['rookie', 'street', 'pro']) {
      const track = makeTrack(t.id),
        racers = Array.from({ length: 6 }, (_, i) =>
          createRacer(track, String(i), 'AI', i, true)
        );
      let time = 0;
      for (; time < 480 && !racers.every((r) => r.finished); time += STEP)
        stepRace(racers, track, STEP, time, d);
      assert.ok(
        racers.every((r) => r.finished),
        `${t.id}/${d} stuck driver`
      );
      for (const r of racers) {
        assert.equal(r.lap, 4);
        assert.equal(r.gates, 13);
        assert.ok(r.finishTime > 30);
      }
    }
});
test('left/right steering follows chase-camera screen direction', () => {
  const t = makeTrack();
  for (const direction of [-1, 1]) {
    const r = createRacer(t, 'you', 'You');
    r.speed = 20;
    const yaw = r.yaw;
    stepRacer(
      r,
      { steer: direction, brake: false, drift: false, boost: false },
      t,
      STEP,
      1
    );
    assert.equal(Math.sign(r.yaw - yaw), -direction);
  }
});
test('steering reverses progressively and braking stops a kart within a controlled distance', () => {
  const t = { ...makeTrack(), width: 1000 };
  const r = createRacer(t, 'handling', 'Driver');
  r.speed = 25;
  const input = { steer: 1, brake: false, drift: false, boost: false };
  for (let i = 0; i < 18; i++) stepRacer(r, input, t, STEP, i * STEP);
  assert.ok(r.steering > 0.8 && r.steering <= 1);
  stepRacer(r, { ...input, steer: -1 }, t, STEP, 1);
  assert.ok(
    r.steering > 0,
    'rack must cross center instead of snapping to opposite lock'
  );
  for (let i = 0; i < 20; i++)
    stepRacer(r, { ...input, steer: -1 }, t, STEP, 1 + i * STEP);
  assert.ok(r.steering < -0.8);
  const stop = createRacer(t, 'brakes', 'Driver');
  stop.speed = 25;
  const start = { x: stop.x, z: stop.z };
  for (let i = 0; i < 66; i++)
    stepRacer(stop, { ...input, steer: 0, brake: true }, t, STEP, i * STEP);
  const distance = Math.hypot(stop.x - start.x, stop.z - start.z);
  assert.equal(stop.speed, 0);
  assert.ok(distance > 9 && distance < 13, `braking distance ${distance}`);
});
test('finish-line oscillation cannot earn laps; nonfinite steering and empty boost are bounded', () => {
  const t = makeTrack(),
    r = createRacer(t, 'you', 'You');
  r.lap = 1;
  r.nextGate = 1;
  r.index = 359;
  r.gates = 1;
  for (let i = 0; i < 12; i++) {
    const p = t.points[i % 2 ? 358 : 1];
    r.x = p.x;
    r.z = p.z;
    r.speed = 0;
    stepRacer(
      r,
      { steer: NaN, brake: false, drift: false, boost: true },
      t,
      STEP,
      1
    );
  }
  assert.equal(r.lap, 1);
  assert.equal(r.gates, 1);
  r.boost = 0.01;
  stepRacer(
    r,
    { steer: 0, brake: false, drift: false, boost: true },
    t,
    STEP,
    2
  );
  assert.ok(r.boost >= 0);
  assert.ok(Number.isFinite(r.yaw));
});
test('real multiplayer clients: ready/start, authority, isolation, reconnect, finish, rematch and cleanup', async (t) => {
  const http = createServer(),
    io = new Server(http, { transports: ['websocket'] });
  let now = Date.now();
  const service = attachKartRoyale(io, { clock: () => now });
  await new Promise((r) => http.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${http.address().port}`,
    clients = [];
  const connect = async () => {
    const c = client(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });
    clients.push(c);
    await new Promise((yes, no) => {
      c.once('connect', yes);
      c.once('connect_error', no);
    });
    return c;
  };
  const emit = (s, event, data = {}) => {
    now += 700;
    return new Promise((yes, no) =>
      s
        .timeout(1000)
        .emit(`kart:${event}`, data, (e, r) => (e ? no(e) : yes(r)))
    );
  };
  const tick = async (ms = 80) => {
    now += ms;
    await new Promise((r) => setTimeout(r, 75));
  };
  t.after(async () => {
    clients.forEach((c) => c.disconnect());
    service.close();
    await new Promise((r) => io.close(r));
  });
  const a = await connect(),
    b = await connect(),
    outsider = await connect();
  const created = await emit(a, 'create', { name: 'Alpha', trackId: 'neon' });
  assert.equal(created.ok, true);
  assert.match(created.code, /^[A-F0-9]{6}$/);
  assert.equal(created.state.players[0].token, undefined);
  assert.equal(created.state.players[0].socketId, undefined);
  assert.equal((await emit(a, 'start')).ok, false);
  const joined = await emit(b, 'join', { code: created.code, name: 'Bravo' });
  assert.equal(joined.ok, true);
  assert.equal((await emit(b, 'start')).ok, false);
  assert.equal((await emit(a, 'start')).ok, false);
  assert.equal((await emit(a, 'appearance', { kartId: 'oodi' })).ok, true);
  assert.equal(
    (await emit(outsider, 'appearance', { kartId: 'oozi' })).ok,
    false
  );
  await emit(a, 'ready', { ready: true });
  await emit(b, 'ready', { ready: true });
  const resume = {
    code: created.code,
    playerId: created.playerId,
    token: created.token
  };
  assert.equal((await emit(a, 'resume', resume)).state.players.length, 2);
  assert.equal(
    (await emit(outsider, 'resume', { ...resume, token: 'ü'.repeat(48) })).ok,
    false
  );
  assert.equal((await emit(a, 'start')).ok, true);
  const room = service.rooms.get(created.code);
  assert.equal(room.racers.length, 6);
  assert.equal(room.racers[0].kartId, 'oodi');
  assert.equal(room.racers.filter((r) => r.ai).length, 4);
  const originalX = room.racers[0].x;
  const originalShield = room.racers[0].shield;
  a.emit('kart:input', {
    steer: 0,
    boost: true,
    lap: 100,
    speed: 9999,
    x: 1e9,
    z: 1e9,
    health: 999999,
    shield: 999999,
    weapon: 'rocket',
    use: true
  });
  outsider.emit('kart:input', {
    playerId: created.playerId,
    steer: -1,
    lap: 99
  });
  a.emit('kart:input', null);
  a.emit('kart:ready', null, 'not-a-callback');
  await tick(4000);
  assert.equal(room.status, 'racing');
  assert.ok(room.racers[0].lap < 2);
  assert.ok(Math.abs(room.racers[0].x - originalX) < 20);
  assert.ok(room.racers[0].speed < 45);
  assert.ok(room.racers[0].health <= 100);
  assert.equal(room.racers[0].weapon, undefined);
  assert.equal(
    room.racers[0].shield,
    originalShield,
    'clients cannot overwrite server-authoritative shield reserves'
  );
  assert.equal(
    (await emit(outsider, 'join', { code: created.code })).ok,
    false
  );
  let leaked = false;
  outsider.on('kart:state', () => {
    leaked = true;
  });
  await tick();
  assert.equal(leaked, false);
  const disconnected = new Promise((r) =>
    io.sockets.sockets.get(a.id).once('disconnect', r)
  );
  a.disconnect();
  await disconnected;
  assert.equal(room.racers[0].disconnected, true);
  const replacement = await connect();
  assert.equal((await emit(replacement, 'resume', resume)).ok, true);
  assert.equal(room.players.length, 2);
  assert.equal(room.racers[0].disconnected, false);
  // Both remote humans are driven by an input controller, never by position packets.
  for (let i = 0; i < 1600 && room.status !== 'finished'; i++) {
    for (const [s, id] of [
      [replacement, created.playerId],
      [b, joined.playerId]
    ])
      s.emit(
        'kart:input',
        aiInput(
          room.racers.find((r) => r.id === id),
          room.track,
          room.elapsed,
          'pro'
        )
      );
    now += 190;
    await new Promise((r) => setTimeout(r, 17));
  }
  assert.equal(room.status, 'finished');
  assert.ok(
    room.racers.filter((r) => !r.ai).every((r) => r.finished),
    'remote drivers finish through server simulation'
  );
  assert.equal((await emit(b, 'rematch')).ok, false);
  assert.equal((await emit(replacement, 'rematch')).ok, true);
  assert.equal(room.status, 'waiting');
  assert.ok(room.players.every((p) => !p.ready));
  const departed = new Promise((r) =>
    io.sockets.sockets.get(replacement.id).once('disconnect', r)
  );
  replacement.disconnect();
  await departed;
  await tick(16000);
  assert.equal(room.players.length, 1);
  assert.equal(room.hostId, joined.playerId);
  await emit(b, 'leave');
  assert.equal(service.rooms.size, 0);
});
