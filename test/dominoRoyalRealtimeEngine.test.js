import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDominoRoyalAction,
  createDominoRoyalState,
  publicDominoRoyalState
} from '../bot/utils/dominoRoyalRealtimeEngine.js';

test('Domino Royal realtime state starts with deterministic private hands', () => {
  const players = [
    { id: 'p1', name: 'A' },
    { id: 'p2', name: 'B' },
    { id: 'p3', name: 'C' }
  ];
  const state = createDominoRoyalState({ tableId: 'domino-test', players, seed: 'seed-1' });

  assert.equal(state.players.length, 3);
  assert.equal(state.chain.length, 1);
  assert.equal(state.players.reduce((sum, player) => sum + player.hand.length, 0), 20);
  assert.equal(state.boneyard.length, 7);

  const p1View = publicDominoRoyalState(state, 'p1');
  assert.equal(p1View.players[0].hand.length, p1View.players[0].handCount);
  assert.equal(p1View.players[1].hand.length, 0);
  assert.equal(p1View.players[1].handCount, state.players[1].hand.length);
});

test('Domino Royal realtime engine rejects out-of-turn and illegal actions', () => {
  const state = createDominoRoyalState({
    tableId: 'domino-test-2',
    players: [
      { id: 'p1', name: 'A' },
      { id: 'p2', name: 'B' }
    ],
    seed: 'seed-2'
  });
  const currentId = state.players[state.currentSeat].id;
  const otherId = state.players.find((player) => player.id !== currentId).id;

  assert.equal(applyDominoRoyalAction(state, { type: 'pass' }, otherId).error, 'not_your_turn');

  const playable = state.players[state.currentSeat].hand.find(
    (tile) => tile.a === state.ends.L || tile.b === state.ends.L || tile.a === state.ends.R || tile.b === state.ends.R
  );
  if (playable) {
    assert.equal(applyDominoRoyalAction(state, { type: 'pass' }, currentId).error, 'play_available');
  }
});

test('Domino Royal realtime engine accepts a legal play and advances turn', () => {
  const state = createDominoRoyalState({
    tableId: 'domino-test-3',
    players: [
      { id: 'p1', name: 'A' },
      { id: 'p2', name: 'B' }
    ],
    seed: 'seed-3'
  });
  const currentSeat = state.currentSeat;
  const currentId = state.players[currentSeat].id;
  const playable = state.players[currentSeat].hand.find(
    (tile) => tile.a === state.ends.L || tile.b === state.ends.L || tile.a === state.ends.R || tile.b === state.ends.R
  );

  if (!playable) {
    const result = applyDominoRoyalAction(state, { type: 'draw' }, currentId);
    assert.equal(result.ok, true);
    assert.equal(state.moveSeq, 1);
    return;
  }

  const side = playable.a === state.ends.L || playable.b === state.ends.L ? 'L' : 'R';
  const result = applyDominoRoyalAction(state, { type: 'play', tile: playable, side }, currentId);
  assert.equal(result.ok, true);
  assert.equal(state.chain.length, 2);
  assert.notEqual(state.currentSeat, currentSeat);
  assert.equal(state.moveSeq, 1);
});
