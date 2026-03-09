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
    }
    return this;
  }

  emit(event, payload, cb) {
    if (event === 'seatTable') {
      this.seatRequests.push({ payload, cb });
      cb?.({ success: true, tableId: 'goalrush-1' });
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
    gameType: 'goalrush',
    stake: { token: 'TPC', amount: 100 },
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
  assert.equal(state.snapshot.matchError, '');
  assert.equal(transactions.length, 1, 'debit should happen once and no refund should occur');
  result.cleanup();
});

test('runSimpleOnlineFlow refunds stake when socket reconnection fails', async () => {
  const mockSocket = new MockSocket({ connected: false, connectSucceeds: false });
  const state = createState();
  const transactions = [];

  const result = await runSimpleOnlineFlow({
    gameType: 'goalrush',
    stake: { token: 'TPC', amount: 80 },
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
  assert.equal(state.snapshot.matchError, 'Socket not connected. Please retry.');
  assert.equal(transactions.length, 2, 'debit should be refunded after failed socket reconnection');
  assert.equal(transactions[0][1], -80);
  assert.equal(transactions[1][1], 80);
  assert.equal(transactions[1][2], 'stake_refund');
  result.cleanup();
});
