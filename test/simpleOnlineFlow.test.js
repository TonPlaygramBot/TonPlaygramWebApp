import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import { runSimpleOnlineFlow } from '../webapp/src/utils/simpleOnlineFlow.js';

class MockSocket extends EventEmitter {
  constructor({ connected = false, connectSucceeds = true } = {}) {
    super();
    this.connected = connected;
    this.connectSucceeds = connectSucceeds;
    this.seatRequests = [];
    this.leaveRequests = [];
  }

  connect() {
    if (this.connectSucceeds) {
      this.connected = true;
      setTimeout(() => this.emit('connect'), 0);
    } else {
      setTimeout(() => this.emit('connect_error', new Error('offline')), 0);
    }
    return this;
  }

  emit(event, payload, cb) {
    if (event === 'register') {
      cb?.({ success: true });
      return true;
    }
    if (event === 'seatTable') {
      this.seatRequests.push({ payload, cb });
      cb?.({ success: true, tableId: 'airhockey-1' });
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
    matching: false,
    matchStatus: '',
    matchError: ''
  };

  return {
    snapshot,
    setMatching: (value) => { snapshot.matching = value; },
    setMatchStatus: (value) => { snapshot.matchStatus = value; },
    setMatchError: (value) => { snapshot.matchError = value; }
  };
}

test('runSimpleOnlineFlow reconnects socket before joining a table', async () => {
  const mockSocket = new MockSocket({ connected: false, connectSucceeds: true });
  const state = createState();
  const transactions = [];

  const result = await runSimpleOnlineFlow({
    gameType: 'airhockey',
    stake: { token: 'TPG', amount: 100 },
    state,
    deps: {
      ensureAccountId: () => Promise.resolve('acct-1'),
      getAccountBalance: () => Promise.resolve({ balance: 500 }),
      addTransaction: (...args) => {
        transactions.push(args);
        return Promise.resolve();
      },
      getTelegramId: () => 'tg-1',
      socket: mockSocket
    }
  });

  assert.equal(result.ok, true);
  assert.equal(mockSocket.seatRequests.length, 1);
  assert.deepEqual(
    {
      tpcAccountNumber: mockSocket.seatRequests[0].payload.tpcAccountNumber,
      accountId: mockSocket.seatRequests[0].payload.accountId,
      playerId: mockSocket.seatRequests[0].payload.playerId
    },
    { tpcAccountNumber: 'acct-1', accountId: 'acct-1', playerId: 'acct-1' },
    'all matchmaking events must carry the authoritative TPG account number'
  );
  assert.equal(state.snapshot.matchError, '');
  assert.equal(transactions.length, 0, 'the lobby must not debit before the authoritative seat lock');
  result.cleanup();
});

test('runSimpleOnlineFlow preserves game criteria and owns canonical queue fields', async () => {
  const mockSocket = new MockSocket({ connected: true });
  const state = createState();

  const result = await runSimpleOnlineFlow({
    gameType: 'airhockey',
    stake: { token: 'TPG', amount: 100 },
    maxPlayers: 2,
    matchMeta: {
      winScore: 11,
      arena: 'regular',
      mode: 'local',
      token: 'TON'
    },
    state,
    deps: {
      ensureAccountId: () => Promise.resolve('acct-meta'),
      getAccountBalance: () => Promise.resolve({ balance: 500 }),
      addTransaction: () => Promise.resolve(),
      getTelegramId: () => 'tg-meta',
      socket: mockSocket
    }
  });

  const payload = mockSocket.seatRequests[0].payload;
  assert.deepEqual(payload.matchMeta, {
    winScore: 11,
    arena: 'regular',
    mode: 'online',
    token: 'TPG'
  });
  assert.equal(payload.mode, 'online');
  assert.equal(payload.token, 'TPG');
  result.cleanup();
});

test('runSimpleOnlineFlow leaves stake untouched when private socket connection fails', async () => {
  const mockSocket = new MockSocket({ connected: false, connectSucceeds: false });
  const state = createState();
  const transactions = [];

  const result = await runSimpleOnlineFlow({
    gameType: 'airhockey',
    stake: { token: 'TPG', amount: 80 },
    quickMatch: false,
    state,
    timeoutMs: 100,
    socketConnectTimeoutMs: 40,
    deps: {
      ensureAccountId: () => Promise.resolve('acct-2'),
      getAccountBalance: () => Promise.resolve({ balance: 500 }),
      addTransaction: (...args) => {
        transactions.push(args);
        return Promise.resolve();
      },
      getTelegramId: () => 'tg-2',
      socket: mockSocket
    }
  });

  assert.equal(result.ok, false);
  assert.equal(state.snapshot.matchError, 'Could not start online matchmaking. Please retry.');
  assert.equal(transactions.length, 0, 'failed matchmaking cannot debit or require a refund');
  result.cleanup();
});
