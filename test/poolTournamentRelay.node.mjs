import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createPoolOnlineTournaments } from '../bot/services/poolOnlineTournaments.js';

// Exercise the exact production Pool socket handlers without starting MongoDB,
// unrelated game services or a network listener in the test environment.
const source = await readFile(new URL('../bot/server.js', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf("  socket.on('joinPoolTable'"), source.indexOf("  socket.on('joinSnookerTable'"));
const attachPool = new Function('socket', 'tableMap', 'poolStates', 'poolTournaments', 'resolveTpcIdentity', 'ensureRegistered', 'registerConnection', handlers);

test('production Pool relay seats rivals, transfers turns, freezes results and advances the online bracket', async () => {
  const tableMap = new Map(), poolStates = new Map(), sockets = [];
  const emitTo = (room, event, data, except) => sockets.filter(socket => socket !== except && socket.rooms.has(room)).forEach(socket => socket.emit(event, data));
  const io = { to: room => ({ emit: (name, payload) => emitTo(room, name, payload) }) };
  const service = createPoolOnlineTournaments({ io, tableMap, poolStates });
  for (let index = 0; index < 4; index++) {
    const handlers = new Map();
    const socket = { id: `s${index}`, data: { playerId: `p${index}`, auth: { accountId: `p${index}` } }, rooms: new Set(), messages: [],
      join(room) { this.rooms.add(room); }, leave(room) { this.rooms.delete(room); },
      on(name, fn) { handlers.set(name, fn); }, emit(name, payload) { this.messages.push({ name, payload }); },
      to(room) { return { emit: (name, payload) => emitTo(room, name, payload, this) }; },
      send(name, payload, callback) { return handlers.get(name)(payload, callback); } };
    attachPool(socket, tableMap, poolStates, service, payload => payload.accountId,
      (socket, account) => account === socket.data.playerId, async () => {});
    sockets.push(socket);
  }
  const act = (index, action, extra = {}) => service.act(sockets[index], { accountId: `p${index}`, action, id: event?.id, ...extra });
  let event = null;
  event = act(0, 'create', { size: 4, variant: 'american' });
  for (let index = 1; index < 4; index++) event = act(index, 'join');
  event = act(0, 'start');
  const pair = event.draw[0][0], a = sockets.find(socket => socket.data.playerId === pair.a), b = sockets.find(socket => socket.data.playerId === pair.b);
  for (const socket of [a, b]) {
    let joined;
    await socket.send('joinPoolTable', { tableId: pair.tableId, accountId: socket.data.playerId }, value => { joined = value; });
    assert.equal(joined.success, true);
  }
  b.send('poolShot', { tableId: pair.tableId, state: { activePlayer: 'A' } });
  assert.equal(poolStates.get(pair.tableId).state, null, 'B cannot send the initial A shot');
  a.send('poolShot', { tableId: pair.tableId, state: { activePlayer: 'B', frameOver: false }, layout: [{ id: 'cue', pos: { x: 1, y: 2 } }] });
  assert.equal(b.messages.at(-1).name, 'poolState');
  assert.equal(b.messages.at(-1).payload.state.activePlayer, 'B');
  b.send('poolShot', { tableId: pair.tableId, state: { activePlayer: 'B', frameOver: true, winner: 'A' }, layout: [] });
  assert.equal(a.messages.at(-1).payload.state.winner, 'A');
  const revision = poolStates.get(pair.tableId).revision;
  a.send('poolShot', { tableId: pair.tableId, state: { frameOver: true, winner: 'B' } });
  assert.equal(poolStates.get(pair.tableId).revision, revision, 'terminal result cannot be overwritten');
  for (const socket of [a, b]) event = act(sockets.indexOf(socket), 'report', { tableId: pair.tableId, winner: 'A' });
  assert.equal(event.draw[0][0].winner, pair.a);
  // A reconnect receives the same terminal result and cannot replay the match.
  a.messages.length = 0;
  await a.send('joinPoolTable', { tableId: pair.tableId, accountId: pair.a });
  assert.equal(a.messages.find(message => message.name === 'poolState').payload.state.winner, 'A');
  assert.equal(service.canUpdate(tableMap.get(pair.tableId), pair.a), false);
});
