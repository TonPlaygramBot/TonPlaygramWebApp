import test from 'node:test';
import assert from 'node:assert/strict';

import { joinDominoRoyalLobby, searchDominoRoyalLobby } from '../webapp/src/pages/Games/dominoRoyalMatchmaking.js';

class FakeSocket {
  constructor({ connected = true, registerResponse = { success: true }, seatResponse } = {}) {
    this.connected = connected;
    this.registerResponse = registerResponse;
    this.seatResponse = seatResponse || { success: true, tableId: 'DR-table-1' };
    this.events = [];
    this.listeners = new Map();
  }

  once(event, handler) {
    this.listeners.set(event, handler);
  }

  off(event) {
    this.listeners.delete(event);
  }

  connect() {
    this.connected = true;
    queueMicrotask(() => this.listeners.get('connect')?.());
  }

  emit(event, payload, callback) {
    this.events.push({ event, payload });
    const response = event === 'register' ? this.registerResponse : this.seatResponse;
    queueMicrotask(() => callback?.(response));
  }
}

test('Domino lobby waits for registration before seating with matching criteria', async () => {
  const socket = new FakeSocket({ connected: false });
  const criteria = {
    gameType: 'domino-royal',
    maxPlayers: 4,
    stake: 100,
    matchMeta: { variant: 'points', targetPoints: '101', token: 'TPC' }
  };

  const result = await joinDominoRoyalLobby({ socket, accountId: 'TPC-100', criteria });

  assert.equal(result.success, true);
  assert.deepEqual(socket.events.map(({ event }) => event), ['register', 'seatTable']);
  assert.deepEqual(socket.events[0].payload, {
    accountId: 'TPC-100',
    tpcAccountNumber: 'TPC-100'
  });
  assert.deepEqual(socket.events[1].payload, {
    ...criteria,
    accountId: 'TPC-100',
    tpcAccountNumber: 'TPC-100'
  });
});

test('Domino lobby refresh searches again using the same TPC account number', async () => {
  const socket = new FakeSocket({
    seatResponse: { success: true, tableId: 'DR-table-2', players: [{ id: 'TPC-300' }] }
  });

  const result = await searchDominoRoyalLobby({
    socket,
    accountId: 'TPC-300',
    criteria: { gameType: 'domino-royal', maxPlayers: 2, stake: 100 }
  });

  assert.equal(result.tableId, 'DR-table-2');
  assert.deepEqual(socket.events, [{
    event: 'seatTable',
    payload: {
      gameType: 'domino-royal',
      maxPlayers: 2,
      stake: 100,
      accountId: 'TPC-300',
      tpcAccountNumber: 'TPC-300'
    }
  }]);
});

test('Domino lobby never requests a seat when registration fails', async () => {
  const socket = new FakeSocket({
    registerResponse: { success: false, error: 'identity_mismatch' }
  });

  const result = await joinDominoRoyalLobby({
    socket,
    accountId: 'TPC-200',
    criteria: { gameType: 'domino-royal', maxPlayers: 2, stake: 0 }
  });

  assert.deepEqual(result, { success: false, error: 'identity_mismatch' });
  assert.deepEqual(socket.events.map(({ event }) => event), ['register']);
});
