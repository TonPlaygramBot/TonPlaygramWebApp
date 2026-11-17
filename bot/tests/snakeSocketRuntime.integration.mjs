// Actual local Socket.IO and ephemeral Mongo; synthetic credentials/accounts only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { verifySocialCredentials } from '../middleware/socialAuth.js';
import { createSnakeSocketRuntime } from '../services/settlement/snakeSocketRuntime.js';
import { createSnakeReservationProducer, gameFundingFingerprint } from '../services/settlement/snakeReservationProducer.js';
import { createSnakeRoundCoordinator } from '../services/settlement/snakeRoundCoordinator.js';
import { createSnakeMoveJournal } from '../services/settlement/snakeMoveJournal.js';
import { snakeJournalRulesHash } from '../services/settlement/snakeDurableRules.js';
const TOKEN = 'synthetic-socket-runtime-token';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function signed(id, token = TOKEN) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id }) });
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update([...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n')).digest('hex'));
  return { initData: params.toString() };
}
test('unwired Snake socket orchestration with real auth, DB commits and direct delivery', async t => {
  let replica; let connection; let serial = 0;
  try {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1, args: ['--nounixsocket'] } });
    connection = await mongoose.createConnection(replica.getUri(), { dbName: 'snake_socket_test' }).asPromise();
    const client = connection.getClient();
    async function fixture() {
      const db = client.db(`snake_socket_${++serial}`);
      const names = ['offers', 'consents', 'users', 'fundingAudits', 'accountLocks', 'escrowMatches', 'lifecycleMatches', 'journal', 'receipts', 'gameStates', 'gameMoves'];
      for (const name of names) await db.createCollection(name); const c = Object.fromEntries(names.map(name => [name, db.collection(name)]));
      await c.gameMoves.createIndex({ matchId: 1, sequence: 1 }, { unique: true });
      const people = ['a', 'b', 'house'].map((id, i) => ({ _id: `u-${id}`, tpcAccountNumber: id, telegramId: i + 1, balance: 100, transactions: [] }));
      await c.users.insertMany(people); await c.fundingAudits.insertMany(people.map(user => ({ _id: user.tpcAccountNumber, assetId: 'test-ledger', userId: user._id, status: 'verified', version: 0, fingerprint: gameFundingFingerprint(user), availableUnits: '100' })));
      const board = { snakes: {}, ladders: {}, diceCells: {} }; const at = Date.now();
      await c.offers.insertOne({ _id: 'm', matchId: 'm', roomId: 'room', offerId: 'o', gameType: 'snake', assetId: 'test-ledger', status: 'offered', revision: 0, expiresAt: at + 300000,
        rulesVersion: 'snake-server-single-die-v1', turnOrder: ['a', 'b'], accountIds: ['a', 'b'], stakeUnits: '10', rulesHash: snakeJournalRulesHash('snake-server-single-die-v1', board), board,
        feePolicy: { policyId: 'test', units: '2', accountId: 'house' } });
      await c.lifecycleMatches.insertOne({ _id: 'm', matchId: 'm', offerId: 'o', status: 'offered', version: 0, updatedAt: at, accountIds: ['a', 'b'] });
      const verifyCredentials = credentials => verifySocialCredentials(credentials, { botToken: TOKEN, maxAgeSeconds: 3600 });
      const producer = createSnakeReservationProducer({ ...c, client, assetId: 'test-ledger', verifyCredentials });
      const realCoordinator = createSnakeRoundCoordinator({ ...c, client, assetId: 'test-ledger' }); let settlementUnavailable = false; let startFailure = null; let recoveryUnavailable = false;
      const coordinator = { ...realCoordinator, start: async (...a) => { if (startFailure === 'before') throw new Error('start_failed'); const result = await realCoordinator.start(...a); if (startFailure === 'after') throw new Error('lost_start_ack'); return result; }, finish: (...a) => settlementUnavailable ? Promise.reject(new Error('simulated_settlement_outage')) : realCoordinator.finish(...a) };
      let clock = Date.now(); let dice = 0;
      const moves = createSnakeMoveJournal({ ...c, client, verifyCredentials, now: () => (clock += 1000), rollDie: () => (++dice % 10 === 0 ? 1 : 6) });
      const server = createServer(); const io = new Server(server); let gate = null; let lookupMutation = null;
      const runtimeUsers = { find: query => ({ limit: n => ({ toArray: async () => {
        if (lookupMutation && Object.keys(query).length === 1 && query.tpcAccountNumber === lookupMutation.accountId) {
          const mutation = lookupMutation; lookupMutation = null;
          await c.users.updateOne({ tpcAccountNumber: mutation.accountId }, { $set: mutation.kind === 'ban' ? { isBanned: true } : { telegramId: 99 } });
        }
        return c.users.find(query).limit(n).toArray();
      } }) }) };
      const evidence = () => ({ status: 'verified', assetId: 'test-ledger', ledgerGeneration: 'synthetic-only', cutoverId: 'test-cutover', writerPolicyHash: 'a'.repeat(64), expiresAt: Date.now() + 300000 });
      const runtime = createSnakeSocketRuntime({ ...c, users: runtimeUsers, io, producer, coordinator, moves: { ...moves, recover: (...a) => recoveryUnavailable ? Promise.reject(new Error('recovery_unavailable')) : moves.recover(...a) }, assetId: 'test-ledger', verifyCredentials, readiness: async () => gate });
      io.on('connection', socket => { runtime.attach(socket); socket.on('legacy:join', (room, ack) => { socket.join(room); ack?.(); }); });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const sockets = []; const states = new Map();
      async function peer() {
        const socket = connect(`http://127.0.0.1:${server.address().port}`, { transports: ['websocket'], forceNew: true, reconnection: false });
        await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
        sockets.push(socket); states.set(socket, []); socket.on('snake:v1:state', state => states.get(socket).push(state)); return socket;
      }
      const a = await peer(); const b = await peer(); const outsider = await peer();
      async function call(socket, event, payload) { return socket.timeout(3000).emitWithAck(event, payload); }
      async function acceptOnly() {
        gate = evidence();
        const response = await call(a, 'snake:v1:offer', { matchId: 'm', credentials: signed(1) }); assert.equal(response.ok, true);
        for (const [socket, identity] of [[a, 1], [b, 2]]) assert.equal((await call(socket, 'snake:v1:accept', { matchId: 'm', termsHash: response.offer.termsHash, credentials: signed(identity) })).ok, true);
      }
      async function acceptStart() {
        await acceptOnly();
        const started = await runtime.reserveAndStart('m'); assert.equal(started.started, true);
        for (const [socket, identity] of [[a, 1], [b, 2]]) assert.equal((await call(socket, 'snake:v1:sync', { matchId: 'm', credentials: signed(identity) })).ok, true);
      }
      const roll = (v, extra = {}) => call(a, 'snake:v1:roll', { matchId: 'm', requestId: `r${v}`, expectedVersion: v, credentials: signed(1), ...extra });
      const close = async () => { sockets.forEach(s => s.disconnect()); await new Promise(resolve => io.close(resolve)); await db.dropDatabase(); };
      return { c, a, b, outsider, call, acceptStart, acceptOnly, roll, runtime, states, evidence, setGate: value => { gate = value; }, setLookupMutation: value => { lookupMutation = value; }, setSettlementUnavailable: value => { settlementUnavailable = value; }, setStartFailure: value => { startFailure = value; }, setRecoveryUnavailable: value => { recoveryUnavailable = value; }, close };
    }
    await t.test('closed gate and bare boolean never create consent or debit; forged identity gets explicit error', async () => {
      const f = await fixture(); try {
        const payload = { matchId: 'm', credentials: signed(1) };
        assert.equal((await f.call(f.a, 'snake:v1:offer', payload)).error, 'paid_play_unavailable');
        f.setGate(true); assert.equal((await f.call(f.a, 'snake:v1:offer', payload)).error, 'paid_play_unavailable');
        f.setGate(f.evidence()); assert.equal((await f.call(f.a, 'snake:v1:offer', { ...payload, credentials: signed(1, 'forged') })).error, 'reauthentication_required');
        assert.equal(await f.c.consents.countDocuments(), 0); assert.equal((await f.c.users.findOne({ _id: 'u-a' })).balance, 100);
      } finally { await f.close(); }
    });
    await t.test('signed consent/start/roll broadcasts only committed redacted state; legacy joins cannot listen', async () => {
      const f = await fixture(); try {
        await f.acceptStart(); await f.outsider.timeout(3000).emitWithAck('legacy:join', 'm'); await f.outsider.timeout(3000).emitWithAck('legacy:join', f.b.id);
        assert.equal((await f.call(f.outsider, 'snake:v1:sync', { matchId: 'm', credentials: signed(3) })).error, 'seat_required');
        const ack = await f.roll(0); assert.equal(ack.ok, true); assert.equal(ack.moveCommitted, true);
        assert.equal((await f.c.gameStates.findOne({ _id: 'm' })).version, 1);
        await pause(25); assert.equal(f.states.get(f.b).at(-1).version, 1); assert.equal(f.states.get(f.outsider).length, 0);
        assert.equal(/accountId|userId|tpcAccountNumber|transactions|selector/.test(JSON.stringify(ack)), false);
        const duplicate = await f.roll(0); assert.equal(duplicate.duplicate, true); assert.equal(await f.c.gameMoves.countDocuments(), 2);
        const invalid = await f.roll(1, { dice: 6 }); assert.equal(invalid.error, 'invalid_request'); assert.equal(await f.c.gameMoves.countDocuments(), 2);
      } finally { await f.close(); }
    });
    await t.test('failed or revoked move emits no new state, logout removes subscription', async () => {
      const f = await fixture(); try {
        await f.acceptStart(); const invalid = await f.call(f.b, 'snake:v1:roll', { matchId: 'm', requestId: 'wrong-turn', expectedVersion: 0, credentials: signed(2) });
        assert.equal(invalid.error, 'not_your_turn'); assert.equal(f.states.get(f.a).length, 0);
        await f.b.timeout(3000).emitWithAck('snake:v1:logout'); await f.roll(0); await pause(25); assert.equal(f.states.get(f.b).length, 0);
        await f.c.users.updateOne({ _id: 'u-a' }, { $set: { isBanned: true } });
        const banned = await f.roll(1); assert.equal(banned.error, 'reauthentication_required'); assert.equal((await f.c.gameStates.findOne({ _id: 'm' })).version, 1);
      } finally { await f.close(); }
    });
    await t.test('committed win with failed payout reports pending; trusted retry settles once and sync recovers', async () => {
      const f = await fixture(); try {
        await f.acceptStart(); f.setSettlementUnavailable(true); let ack;
        for (let v = 0; v < 10; v++) ack = await f.roll(v);
        assert.equal(ack.ok, true); assert.equal(ack.moveCommitted, true); assert.equal(ack.payoutStatus, 'pending'); assert.equal(ack.state.payoutStatus, 'pending');
        assert.equal(await f.c.receipts.countDocuments(), 0); assert.equal((await f.c.users.findOne({ _id: 'u-a' })).balance, 90);
        f.setSettlementUnavailable(false); assert.equal((await f.runtime.retryFinishedSettlement('m')).settled, true);
        assert.equal((await f.runtime.retryFinishedSettlement('m')).settled, true); assert.equal(await f.c.receipts.countDocuments(), 1);
        const sync = await f.call(f.a, 'snake:v1:sync', { matchId: 'm', credentials: signed(1) }); assert.equal(sync.state.payoutStatus, 'settled');
        assert.equal((await f.c.users.findOne({ _id: 'u-a' })).balance, 108); assert.equal(sync.state.prizeUnits, '18');
      } finally { await f.close(); }
    });
    await t.test('postcommit notification read failure does not report a committed roll as failed', async () => {
      const f = await fixture(); try {
        await f.acceptStart(); f.setRecoveryUnavailable(true);
        const ack = await f.roll(0); assert.equal(ack.ok, true); assert.equal(ack.moveCommitted, true); assert.equal(ack.state, undefined);
        assert.equal((await f.c.gameStates.findOne({ _id: 'm' })).version, 1);
        f.setRecoveryUnavailable(false); const sync = await f.call(f.a, 'snake:v1:sync', { matchId: 'm', credentials: signed(1) });
        assert.equal(sync.state.version, 1);
      } finally { await f.close(); }
    });
    await t.test('prestart worker failure refunds; socket can verify committed refund', async () => {
      const f = await fixture(); try {
        await f.acceptOnly(); f.setStartFailure('before'); await assert.rejects(f.runtime.reserveAndStart('m'), /start_failed/);
        const sync = await f.call(f.a, 'snake:v1:sync', { matchId: 'm', credentials: signed(1) });
        assert.equal(sync.ok, true); assert.equal(sync.state.started, false); assert.equal(sync.state.payoutStatus, 'refunded');
        assert.equal((await f.c.users.findOne({ _id: 'u-a' })).balance, 100); assert.equal(await f.c.accountLocks.countDocuments(), 0);
      } finally { await f.close(); }
    });
    await t.test('lost start acknowledgement cannot trigger refund or second debit; retry recovers', async () => {
      const f = await fixture(); try {
        await f.acceptOnly(); f.setStartFailure('after'); await assert.rejects(f.runtime.reserveAndStart('m'), /lost_start_ack/);
        assert.equal((await f.c.lifecycleMatches.findOne({ _id: 'm' })).status, 'playing'); assert.equal(await f.c.receipts.countDocuments(), 0);
        f.setStartFailure(null); const recovered = await f.runtime.reserveAndStart('m'); assert.equal(recovered.recovered, true);
        assert.equal((await f.c.users.findOne({ _id: 'u-a' })).balance, 90); assert.equal(await f.c.accountLocks.countDocuments(), 2);
      } finally { await f.close(); }
    });
    await t.test('changing socket identity to a nonmember revokes old game subscription', async () => {
      const f = await fixture(); try {
        await f.acceptStart(); const changed = await f.call(f.b, 'snake:v1:sync', { matchId: 'm', credentials: signed(3) });
        assert.equal(changed.error, 'seat_required'); await f.roll(0); await pause(25); assert.equal(f.states.get(f.b).length, 0);
      } finally { await f.close(); }
    });
    await t.test('second canonical identity lookup rejects a newly banned account', async () => {
      const f = await fixture(); try {
        f.setGate(f.evidence()); f.setLookupMutation({ accountId: 'a', kind: 'ban' });
        const reply = await f.call(f.a, 'snake:v1:offer', { matchId: 'm', credentials: signed(1) });
        assert.equal(reply.error, 'reauthentication_required'); assert.equal(reply.offer, undefined);
      } finally { await f.close(); }
    });
    await t.test('second delivery lookup rejects provider relink instead of using stale subscription identity', async () => {
      const f = await fixture(); try {
        await f.acceptStart(); f.setLookupMutation({ accountId: 'b', kind: 'relink' });
        const reply = await f.roll(0); assert.equal(reply.moveCommitted, true); await pause(25);
        assert.equal(f.states.get(f.b).length, 0); assert.equal((await f.c.users.findOne({ _id: 'u-b' })).telegramId, 99);
      } finally { await f.close(); }
    });
  } finally { await connection?.close(); await replica?.stop(); }
});
