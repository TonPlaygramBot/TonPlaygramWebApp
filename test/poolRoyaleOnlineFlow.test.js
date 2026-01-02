import { afterAll, expect, test } from '@jest/globals';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import { setTimeout as delay } from 'timers/promises';
import { runPoolRoyaleOnlineFlow } from '../webapp/src/pages/Games/poolRoyaleOnlineFlow.js';
import { socket as realSocket } from '../webapp/src/utils/socket.js';

class MockSocket extends EventEmitter {
  constructor() {
    super();
    this.connected = true;
    this.seatRequests = [];
    this.leaveRequests = [];
  }

  emit(event, payload, cb) {
    if (event === 'seatTable') {
      this.seatRequests.push({ payload, cb });
      return true;
    }
    if (event === 'leaveLobby') {
      this.leaveRequests.push(payload);
      return true;
    }
    return super.emit(event, payload, cb);
  }
}

function createState() {
  const snapshot = {
    matchingError: '',
    matchStatus: '',
    matching: false,
    isSearching: false,
    matchPlayers: [],
    readyList: [],
    spinningPlayer: ''
  };
  return {
    snapshot,
    setMatchingError: (v) => {
      snapshot.matchingError = v;
    },
    setMatchStatus: (v) => {
      snapshot.matchStatus = v;
    },
    setMatching: (v) => {
      snapshot.matching = v;
    },
    setIsSearching: (v) => {
      snapshot.isSearching = v;
    },
    setMatchPlayers: (v) => {
      snapshot.matchPlayers = v;
    },
    setReadyList: (v) => {
      snapshot.readyList = v;
    },
    setSpinningPlayer: (v) => {
      snapshot.spinningPlayer = v;
    }
  };
}

function createRefs() {
  return {
    accountIdRef: { current: null },
    matchPlayersRef: { current: [] },
    pendingTableRef: { current: '' },
    cleanupRef: { current: () => {} },
    spinIntervalRef: { current: null },
    stakeDebitRef: { current: null },
    matchTimeoutRef: { current: null },
    seatTimeoutRef: { current: null }
  };
}

afterAll(() => {
  realSocket?.disconnect?.();
  realSocket?.close?.();
});

test('runPoolRoyaleOnlineFlow debits once and keeps stake for game start', async () => {
  const mockSocket = new MockSocket();
  const refs = createRefs();
  const state = createState();
  const addCalls = [];
  const started = [];

  const deps = {
    ensureAccountId: () => Promise.resolve('acct-1'),
    getAccountBalance: () => Promise.resolve({ balance: 200 }),
    addTransaction: (...args) => {
      addCalls.push(args);
      return Promise.resolve();
    },
    getTelegramId: () => 'tg-1',
    getTelegramFirstName: () => 'Alice',
    socket: mockSocket
  };

  await runPoolRoyaleOnlineFlow({
    stake: { token: 'TPC', amount: 100 },
    variant: 'uk',
    ballSet: 'american',
    playType: 'regular',
    mode: 'online',
    tableSize: 'medium',
    avatar: 'me.png',
    deps,
    state,
    refs,
    timeouts: { seat: 50, matchmaking: 200 },
    onGameStart: (payload) => started.push(payload)
  });

  assert.equal(mockSocket.seatRequests.length, 1);
  const seatPayload = mockSocket.seatRequests[0].payload;
  assert.equal(seatPayload.ballSet, 'american');
  assert.equal(seatPayload.variant, 'uk');
  assert.equal(seatPayload.mode, 'online');
  assert.equal(seatPayload.tableSize, 'medium');
  assert.equal(seatPayload.playType, 'regular');
  const seatCb = mockSocket.seatRequests[0].cb;
  seatCb({
    success: true,
    tableId: 'tbl-1',
    players: [
      { id: 'acct-1', name: 'Alice' },
      { id: 'acct-2', name: 'Bob' }
    ],
    ready: ['acct-1']
  });

  mockSocket.emit('gameStart', {
    tableId: 'tbl-1',
    players: [
      { id: 'acct-1', name: 'Alice' },
      { id: 'acct-2', name: 'Bob' }
    ]
  });

  await delay(0);

  expect(addCalls).toHaveLength(1);
  expect(addCalls[0][1]).toBe(-100);
  expect(addCalls[0][2]).toBe('stake');
  expect(started).toHaveLength(1);
  expect(started[0].tableId).toBe('tbl-1');
  expect(refs.stakeDebitRef.current).toBeNull();
});

test('runPoolRoyaleOnlineFlow refunds when matchmaking times out', async () => {
  const mockSocket = new MockSocket();
  const refs = createRefs();
  const state = createState();
  const addCalls = [];

  const deps = {
    ensureAccountId: () => Promise.resolve('acct-9'),
    getAccountBalance: () => Promise.resolve({ balance: 200 }),
    addTransaction: (...args) => {
      addCalls.push(args);
      return Promise.resolve();
    },
    getTelegramId: () => 'tg-9',
    getTelegramFirstName: () => 'Alex',
    socket: mockSocket
  };

  await runPoolRoyaleOnlineFlow({
    stake: { token: 'TPC', amount: 75 },
    variant: 'uk',
    ballSet: 'uk',
    playType: 'regular',
    mode: 'online',
    tableSize: 'medium',
    avatar: 'me.png',
    deps,
    state,
    refs,
    timeouts: { seat: 50, matchmaking: 80 }
  });

  assert.equal(mockSocket.seatRequests.length, 1);
  const seatCb = mockSocket.seatRequests[0].cb;
  seatCb({ success: true, tableId: 'tbl-timeout', players: [], ready: [] });

  await delay(120);

  expect(addCalls).toHaveLength(2);
  expect(addCalls[0][1]).toBe(-75);
  expect(addCalls[1][1]).toBe(75);
  expect(addCalls[1][2]).toBe('stake_refund');
  expect(state.snapshot.matchingError).toContain('timed out');
  expect(refs.pendingTableRef.current).toBe('');
});
