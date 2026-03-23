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
    this.registerRequests = [];
    this.connectCalls = 0;
  }

  connect() {
    this.connectCalls += 1;
    this.connected = true;
    this.emit('connect');
  }

  emit(event, payload, cb) {
    if (event === 'register') {
      this.registerRequests.push(payload);
      if (typeof cb === 'function') cb({ success: true });
      return true;
    }
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
    tableId: 'room-77',
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
  assert.equal(mockSocket.registerRequests.length, 1);
  assert.equal(mockSocket.registerRequests[0].tpcAccountId, 'acct-1');
  const seatPayload = mockSocket.seatRequests[0].payload;
  assert.equal(seatPayload.tpcAccountId, 'acct-1');
  assert.equal(seatPayload.ballSet, 'american');
  assert.equal(seatPayload.variant, 'uk');
  assert.equal(seatPayload.mode, 'online');
  assert.equal(seatPayload.tableSize, 'medium');
  assert.equal(seatPayload.playType, 'regular');
  assert.equal(seatPayload.tableId, 'room-77');
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
    ],
    meta: {
      tableSize: '9ft',
      mode: 'online'
    }
  });

  await delay(0);

  assert.equal(addCalls.length, 1, 'should only debit once');
  assert.equal(addCalls[0][1], -100);
  assert.equal(addCalls[0][2], 'stake');
  assert.equal(started.length, 1);
  assert.equal(started[0].tableId, 'tbl-1');
  assert.equal(started[0].matchMeta?.tableSize, '9ft');
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
    tableId: 'room-timeout',
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
  assert.equal(mockSocket.seatRequests[0].payload.tableId, 'room-timeout');
  seatCb({ success: true, tableId: 'tbl-timeout', players: [], ready: [] });

  await delay(120);

  assert.equal(addCalls.length, 2, 'should debit then refund');
  assert.equal(addCalls[0][1], -75);
  assert.equal(addCalls[1][1], 75);
  assert.equal(addCalls[1][2], 'stake_refund');
  assert.ok(state.snapshot.matchingError.includes('timed out'));
  assert.equal(refs.pendingTableRef.current, '');
});


test('runPoolRoyaleOnlineFlow reconnects socket before seating table', async () => {
  const mockSocket = new MockSocket();
  mockSocket.connected = false;
  const refs = createRefs();
  const state = createState();
  const addCalls = [];

  const deps = {
    ensureAccountId: () => Promise.resolve('acct-3'),
    getAccountBalance: () => Promise.resolve({ balance: 200 }),
    addTransaction: (...args) => {
      addCalls.push(args);
      return Promise.resolve();
    },
    getTelegramId: () => 'tg-3',
    getTelegramFirstName: () => 'Chris',
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
    timeouts: { seat: 50, matchmaking: 100, socketConnect: 50 }
  });

  assert.equal(mockSocket.connectCalls, 1);
  assert.equal(mockSocket.registerRequests.length, 1);
  assert.equal(mockSocket.registerRequests[0].tpcAccountId, 'acct-3');
  assert.equal(mockSocket.seatRequests.length, 1, 'should proceed after reconnecting');
  mockSocket.seatRequests[0].cb({ success: false, message: 'busy' });
  await delay(0);
  assert.equal(addCalls[0][2], 'stake');
});

test('runPoolRoyaleOnlineFlow tolerates transient socket connect errors on mobile', async () => {
  class FlakyConnectSocket extends MockSocket {
    connect() {
      this.connectCalls += 1;
      this.connected = false;
      setTimeout(() => this.emit('connect_error', new Error('temporary network dip')), 5);
      setTimeout(() => {
        this.connected = true;
        this.emit('connect');
      }, 15);
    }
  }

  const mockSocket = new FlakyConnectSocket();
  mockSocket.connected = false;
  const refs = createRefs();
  const state = createState();
  const addCalls = [];

  const deps = {
    ensureAccountId: () => Promise.resolve('acct-4'),
    getAccountBalance: () => Promise.resolve({ balance: 200 }),
    addTransaction: (...args) => {
      addCalls.push(args);
      return Promise.resolve();
    },
    getTelegramId: () => 'tg-4',
    getTelegramFirstName: () => 'Dina',
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
    timeouts: { seat: 50, matchmaking: 100, socketConnect: 60 }
  });

  assert.equal(mockSocket.connectCalls, 1);
  assert.equal(mockSocket.registerRequests.length, 1);
  assert.equal(mockSocket.registerRequests[0].tpcAccountId, 'acct-4');
  assert.equal(mockSocket.seatRequests.length, 1, 'should keep waiting after temporary connect error');
  mockSocket.seatRequests[0].cb({ success: false, message: 'busy' });
  await delay(0);
  assert.equal(state.snapshot.matchingError, 'busy');
  assert.equal(addCalls[0][2], 'stake');
});

test('runPoolRoyaleOnlineFlow tolerates null lobby players and accountId-only entries', async () => {
  const mockSocket = new MockSocket();
  const refs = createRefs();
  const state = createState();
  const started = [];

  const deps = {
    ensureAccountId: () => Promise.resolve('acct-20'),
    getAccountBalance: () => Promise.resolve({ balance: 200 }),
    addTransaction: () => Promise.resolve(),
    getTelegramId: () => 'tg-20',
    getTelegramFirstName: () => 'Mira',
    socket: mockSocket
  };

  await runPoolRoyaleOnlineFlow({
    stake: { token: 'TPC', amount: 50 },
    variant: 'uk',
    ballSet: 'uk',
    playType: 'regular',
    mode: 'online',
    tableSize: 'medium',
    avatar: 'me.png',
    deps,
    state,
    refs,
    timeouts: { seat: 50, matchmaking: 120 },
    onGameStart: (payload) => started.push(payload)
  });

  assert.equal(mockSocket.seatRequests.length, 1);
  mockSocket.seatRequests[0].cb({
    success: true,
    tableId: 'tbl-null-safe',
    players: [null, { accountId: 'acct-30', name: 'Opponent' }],
    ready: []
  });

  mockSocket.emit('lobbyUpdate', {
    tableId: 'tbl-null-safe',
    players: [null, { accountId: 'acct-30', name: 'Opponent' }]
  });

  mockSocket.emit('gameStart', {
    tableId: 'tbl-null-safe',
    players: [null, { accountId: 'acct-30', name: 'Opponent' }]
  });

  await delay(0);

  assert.equal(started.length, 1);
  assert.equal(state.snapshot.matchStatus, '');
  assert.equal(state.snapshot.matchingError, '');
});

test('runPoolRoyaleOnlineFlow refunds if register ack fails', async () => {
  class RejectRegisterSocket extends MockSocket {
    emit(event, payload, cb) {
      if (event === 'register') {
        this.registerRequests.push(payload);
        if (typeof cb === 'function') cb({ success: false, error: 'register_failed' });
        return true;
      }
      return super.emit(event, payload, cb);
    }
  }

  const mockSocket = new RejectRegisterSocket();
  const refs = createRefs();
  const state = createState();
  const addCalls = [];

  const deps = {
    ensureAccountId: () => Promise.resolve('acct-12'),
    getAccountBalance: () => Promise.resolve({ balance: 200 }),
    addTransaction: (...args) => {
      addCalls.push(args);
      return Promise.resolve();
    },
    getTelegramId: () => 'tg-12',
    getTelegramFirstName: () => 'Elena',
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
    timeouts: { seat: 50, matchmaking: 100, register: 40 }
  });

  assert.equal(mockSocket.registerRequests.length, 1);
  assert.equal(mockSocket.seatRequests.length, 0);
  assert.equal(addCalls.length, 2, 'should debit then refund when register ack fails');
  assert.equal(addCalls[1][2], 'stake_refund');
  assert.ok(state.snapshot.matchingError.includes('online session'));
});

test('runPoolRoyaleOnlineFlow retries seat after identity mismatch and starts match', async () => {
  const mockSocket = new MockSocket();
  const refs = createRefs();
  const state = createState();
  const addCalls = [];
  const started = [];

  const deps = {
    ensureAccountId: () => Promise.resolve('acct-22'),
    getAccountBalance: () => Promise.resolve({ balance: 200 }),
    addTransaction: (...args) => {
      addCalls.push(args);
      return Promise.resolve();
    },
    getTelegramId: () => null,
    getTelegramFirstName: () => '',
    socket: mockSocket
  };

  await runPoolRoyaleOnlineFlow({
    stake: { token: 'TPC', amount: 100 },
    variant: 'uk',
    ballSet: 'uk',
    playType: 'regular',
    mode: 'online',
    tableSize: '9ft',
    avatar: 'me.png',
    deps,
    state,
    refs,
    timeouts: { seat: 50, matchmaking: 200, register: 60 },
    onGameStart: (payload) => started.push(payload)
  });

  assert.equal(mockSocket.seatRequests.length, 1);
  mockSocket.seatRequests[0].cb({ success: false, error: 'identity_mismatch' });
  await delay(450);

  assert.equal(mockSocket.registerRequests.length, 2, 'identity mismatch should trigger register retry');
  assert.equal(mockSocket.seatRequests.length, 2, 'identity mismatch should trigger seat retry');

  mockSocket.seatRequests[1].cb({
    success: true,
    tableId: 'tbl-identity',
    players: [
      { id: 'acct-22', name: 'TPC acct-22' },
      { id: 'acct-23', name: 'TPC acct-23' }
    ],
    ready: ['acct-22']
  });
  mockSocket.emit('gameStart', {
    tableId: 'tbl-identity',
    players: [
      { id: 'acct-22', name: 'TPC acct-22' },
      { id: 'acct-23', name: 'TPC acct-23' }
    ],
    currentTurn: 'acct-22'
  });
  await delay(0);

  assert.equal(started.length, 1);
  assert.equal(addCalls.length, 1, 'stake should remain debited when match starts');
  assert.equal(state.snapshot.matchingError, '');
});
