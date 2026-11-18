import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { attachKartRoyale } from '../bot/services/kartRoyale.js';
import { CUPS, STEP, createRacer, makeTrack, stepRacer } from '../webapp/src/games/kartroyale/simulation.mjs';
import { createRaceCombat, stepRaceCombat } from '../webapp/src/games/kartroyale/raceCombat.mjs';
import { recordTimingGate } from '../webapp/src/games/kartroyale/raceTelemetry.mjs';
import { bestTrialLap, normalizeRaceFormat, trialStandings } from '../webapp/src/games/kartroyale/raceFormats.mjs';

async function setup(t) {
  const http = createServer(), io = new Server(http, { transports: ['websocket'] });
  io.use((socket, next) => { socket.data.playerId = socket.handshake.auth.accountId; next(); });
  let now = Date.now();
  const service = attachKartRoyale(io, { clock: () => now, settleMatch: async () => ({ status: 'refunded' }) });
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  const clients = [];
  const connect = async (accountId = '') => {
    const socket = client(`http://127.0.0.1:${http.address().port}`, { auth: { accountId }, transports: ['websocket'], forceNew: true, reconnection: false });
    clients.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return socket;
  };
  const emit = (socket, event, data = {}) => {
    now += 700;
    return new Promise((resolve, reject) => socket.timeout(1000).emit(`kart:${event}`, data, (error, reply) => error ? reject(error) : resolve(reply)));
  };
  const tick = async (advance = 100) => { now += advance; await new Promise((resolve) => setTimeout(resolve, 40)); };
  t.after(async () => { clients.forEach((socket) => socket.disconnect()); service.close(); await new Promise((resolve) => io.close(resolve)); });
  return { connect, emit, tick, service };
}

test('trial ranking uses the fastest valid completed lap and never accepts nonfinite lap times', () => {
  const racers = [
    { id: 'fast-total', finished: true, finishTime: 150, lapTimes: [50, 50, 50] },
    { id: 'best-lap', finished: true, finishTime: 155, lapTimes: [45, 55, 55] },
    { id: 'no-lap', finished: false, progress: 0.9, lapTimes: [NaN, -1, Infinity, 0] }
  ];
  assert.deepEqual(trialStandings(racers).map((racer) => racer.id), ['best-lap', 'fast-total', 'no-lap']);
  assert.equal(bestTrialLap(racers[2]), Infinity);
  assert.equal(normalizeRaceFormat('money-combat'), 'race');
});


test('recovery invalidates trial timing until a fresh complete lap passes every gate', () => {
  const track = makeTrack('skanderbeg'), racer = createRacer(track, 'a', 'A', 0);
  racer.lap = 1; racer.lapStartedAt = 0;
  recordTimingGate(racer, 1, 10); recordTimingGate(racer, 2, 20);
  stepRacer(racer, { recover: true }, track, STEP, 25);
  recordTimingGate(racer, 3, 30); recordTimingGate(racer, 0, 40);
  racer.lapTimes = [40];
  assert.equal(racer.telemetry.lastLap.valid, false);
  assert.equal(bestTrialLap(racer), Infinity, 'invalid recovery lap is not rescued by raw lapTimes');
  racer.lap = 2; racer.lapStartedAt = 40;
  recordTimingGate(racer, 1, 50); recordTimingGate(racer, 2, 60);
  recordTimingGate(racer, 3, 70); recordTimingGate(racer, 0, 80);
  assert.equal(bestTrialLap(racer), 40);
});

test('multiplayer combat controls every human independently and never substitutes AI input for a silent human', () => {
  const track = makeTrack('skanderbeg');
  const racers = [createRacer(track, 'a', 'A', 0), createRacer(track, 'b', 'B', 1)];
  const combat = createRaceCombat(track, racers, 'a');
  for (const weapon of Object.values(combat.weapons)) weapon.aiCooldown = 0;
  stepRaceCombat(combat, racers, track, {}, STEP, 0, { b: { fire: true, shield: true, pulse: true } });
  assert.equal(combat.weapons.a.ammo, 12);
  assert.equal(combat.weapons.a.windup, 0);
  assert.equal(combat.weapons.b.ammo, 11);
  assert.equal(combat.weapons.b.shieldActive, true);
  assert.ok(combat.weapons.b.pulseCooldown > 21);
  assert.equal(combat.weapons.a.pulseCooldown, 0);
});

for (const retired of ['combat', 'trial', 'championship']) {
  test(`legacy ${retired} room requests become ordinary racing`, async (t) => {
    const { connect, emit, tick, service } = await setup(t);
    const host = await connect(), guest = await connect();
    const created = await emit(host, 'create', { trackId: 'skanderbeg', public: true, raceFormat: retired, cupIndex: 1 });
    assert.equal(created.state.raceFormat, 'race');
    assert.equal(created.state.cupIndex, null);
    assert.equal(created.state.trackId, 'skanderbeg');
    const joined = await emit(guest, 'quick', { trackId: 'skanderbeg', raceFormat: 'race' });
    assert.equal(joined.code, created.code, 'retired format does not split matchmaking');
    assert.equal((await emit(guest, 'config', { raceFormat: retired })).ok, false);
    const configured = await emit(host, 'config', { raceFormat: retired, cupIndex: 2 });
    assert.equal(configured.state.raceFormat, 'race');
    assert.equal(configured.state.cupIndex, null);
    assert.equal(configured.state.trackId, 'skanderbeg');
    await emit(host, 'ready', { ready: true }); await emit(guest, 'ready', { ready: true });
    await emit(host, 'start'); await tick(3600);
    const room = service.rooms.get(created.code);
    assert.equal(room.combat, null);
    host.emit('kart:input', { fire: true, pulse: true, reload: true, lapTimes: [0.01], lap: 4, finished: true });
    await tick(100);
    const racer = room.racers.find(r => r.id === created.playerId);
    assert.deepEqual(racer.lapTimes, []);
    assert.equal(racer.finished, false);
    const resumed = await emit(host, 'resume', { code: created.code, playerId: created.playerId, token: created.token });
    assert.equal(resumed.state.raceFormat, 'race');
    assert.equal(resumed.state.timeTrial, false);
    assert.equal(resumed.state.combat, null);
  });
}

test('paid matches force normal racing and reject combat/trial configuration and weapon input', async (t) => {
  const { connect, emit, tick, service } = await setup(t);
  service.createMatch({ id: 'paid-format-guard', stake: 100, meta: { trackId: 'skanderbeg', raceFormat: 'combat', cupIndex: 2 }, players: [{ id: 'A' }, { id: 'B' }] });
  const a = await connect('A'), b = await connect('B');
  const joined = await emit(a, 'match', { tableId: 'paid-format-guard' });
  assert.equal(joined.state.raceFormat, 'race');
  assert.equal(joined.state.cupIndex, null);
  assert.equal((await emit(a, 'config', { raceFormat: 'combat' })).ok, false);
  await emit(b, 'match', { tableId: 'paid-format-guard' }); await tick(3600);
  a.emit('kart:input', { fire: true, reload: true, pulse: true }); await tick(100);
  const room = service.rooms.get('paid-format-guard');
  assert.equal(room.combat, null);
  assert.equal(room.racers[0].input.fire, false);
  assert.equal(room.racers[0].combatInput?.fire, undefined);
});
