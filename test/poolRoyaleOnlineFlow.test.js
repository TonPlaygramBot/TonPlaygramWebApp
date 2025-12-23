import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import { setTimeout as delay } from 'timers/promises';
import { runPoolRoyaleOnlineFlow } from '../webapp/src/pages/Games/poolRoyaleOnlineFlow.js';

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
      ballSet: 'uk',
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
    assert.equal(mockSocket.seatRequests[0].payload.ballSet, 'uk');
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

  assert.equal(addCalls.length, 1, 'should only debit once');
  assert.equal(addCalls[0][1], -100);
  assert.equal(addCalls[0][2], 'stake');
  assert.equal(started.length, 1);
  assert.equal(started[0].tableId, 'tbl-1');
  assert.equal(refs.stakeDebitRef.current, null, 'stake cleared after start');
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

  assert.equal(addCalls.length, 2, 'should debit then refund');
  assert.equal(addCalls[0][1], -75);
  assert.equal(addCalls[1][1], 75);
  assert.equal(addCalls[1][2], 'stake_refund');
  assert.ok(state.snapshot.matchingError.includes('timed out'));
  assert.equal(refs.pendingTableRef.current, '');
});
