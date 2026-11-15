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

test('free room hosts select formats, guests cannot alter them, and quick join respects format', async (t) => {
  const { connect, emit, service } = await setup(t);
  const host = await connect(), guest = await connect(), quick = await connect();
  const created = await emit(host, 'create', { trackId: 'skanderbeg', public: true, raceFormat: 'combat' });
  assert.equal(created.state.raceFormat, 'combat');
  assert.equal(created.state.tableId, null);
  await emit(guest, 'join', { code: created.code });
  assert.equal((await emit(guest, 'config', { raceFormat: 'trial' })).ok, false);
  await emit(guest, 'ready', { ready: true });
  const configured = await emit(host, 'config', { raceFormat: 'championship', cupIndex: 1 });
  assert.equal(configured.state.trackId, CUPS[1].track);
  assert.equal(configured.state.cupIndex, 1);
  assert.ok(configured.state.players.every((player) => !player.ready));
  const other = await emit(quick, 'quick', { trackId: CUPS[1].track, raceFormat: 'trial' });
  assert.notEqual(other.code, created.code);
  assert.equal(service.rooms.get(other.code).raceFormat, 'trial');
});

test('online combat accepts only server-owned weapon inputs, clears stale fire, and stays opt-in', async (t) => {
  const { connect, emit, tick, service } = await setup(t);
  const a = await connect(), b = await connect();
  const created = await emit(a, 'create', { trackId: 'skanderbeg', raceFormat: 'combat' });
  const joined = await emit(b, 'join', { code: created.code });
  await emit(a, 'ready', { ready: true }); await emit(b, 'ready', { ready: true });
  await emit(a, 'start'); await tick(3600);
  const room = service.rooms.get(created.code);
  // Keep the network fixture about human ownership rather than rival targeting.
  for (const racer of room.racers) if (racer.ai) racer.retired = true;
  a.emit('kart:input', { fire: true, ammo: 9999, health: 9999, playerId: joined.playerId, pulse: true });
  b.emit('kart:input', { fire: true, shield: true });
  await new Promise((resolve) => setTimeout(resolve, 10));
  await tick(100);
  assert.ok(room.combat.weapons[created.playerId].ammo < 12);
  assert.ok(room.combat.weapons[joined.playerId].ammo < 12);
  assert.ok(room.racers.every((racer) => racer.health <= 100));
  assert.ok(room.combat.weapons[created.playerId].pulseCooldown > 21);
  assert.equal((await emit(a, 'config', { raceFormat: 'race' })).ok, false);
  // A tap may be followed by its release before the next server physics tick.
  a.emit('kart:input', { reload: true }); a.emit('kart:input', { reload: false });
  await new Promise((resolve) => setTimeout(resolve, 10)); await tick(100);
  assert.ok(room.combat.weapons[created.playerId].reload > 0, 'queued reload survives a release packet');
  await tick(1000);
  assert.ok(Object.values(room.racers.find((racer) => racer.id === created.playerId).combatInput).every((value) => value !== true));
  assert.equal(room.combat.weapons[joined.playerId].shieldActive, false);
});

test('online time trial has no AI, contact, slipstream, or client-supplied times', async (t) => {
  const { connect, emit, tick, service } = await setup(t);
  const a = await connect(), b = await connect();
  const created = await emit(a, 'create', { trackId: 'skanderbeg', raceFormat: 'trial' });
  await emit(b, 'join', { code: created.code });
  await emit(a, 'ready', { ready: true }); await emit(b, 'ready', { ready: true });
  await emit(a, 'start'); await tick(3600);
  const room = service.rooms.get(created.code);
  assert.equal(room.racers.length, 2);
  assert.equal(room.combat, null);
  const [first, second] = room.racers;
  Object.assign(second, { x: first.x, z: first.z, yaw: first.yaw, velocityYaw: first.velocityYaw, index: first.index, speed: 0 });
  a.emit('kart:input', { lapTimes: [0.01], lap: 4, finished: true });
  await tick(100);
  assert.ok(Math.hypot(first.x - second.x, first.z - second.z) < 0.001, 'overlapping trial karts must not push each other');
  assert.deepEqual(first.lapTimes, []);
  assert.equal(first.finished, false);
  Object.assign(first, { finished: true, finishTime: 150, lapTimes: [50, 50, 50] });
  Object.assign(second, { finished: true, finishTime: 155, lapTimes: [45, 55, 55] });
  first.telemetry.bestLap = 50; second.telemetry.bestLap = 45;
  await tick(100);
  const state = await emit(a, 'resume', { code: created.code, playerId: created.playerId, token: created.token });
  assert.equal(state.state.timeTrial, true);
  assert.equal(state.state.results[0].id, second.id);
});

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
