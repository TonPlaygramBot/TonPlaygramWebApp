import test from 'node:test';
import assert from 'node:assert/strict';
import { createRollStateMachine } from '../webapp/src/utils/rollStateMachine.js';
import { rebuildFromSnapshot } from '../webapp/src/utils/rejoin.js';

test('state machine transitions', async () => {
  const log = [];
  const machine = createRollStateMachine({
    apiRoll: async () => {
      log.push('api');
      return { value: 4, sig: 'sig' };
    },
    animate: async () => { log.push('anim'); },
    apply: () => { log.push('apply'); }
  });

  assert.equal(machine.phase, 'IDLE');
  const p = machine.roll('r1');
  assert.equal(machine.phase, 'ROLL_REQUESTED');
  await p;
  assert.equal(machine.phase, 'IDLE');
  assert.deepEqual(log, ['api', 'anim', 'apply']);
});

test('duplicate roll ignored', async () => {
  let apiCalls = 0;
  const machine = createRollStateMachine({
    apiRoll: async () => { apiCalls++; return { value: 1, sig: 's' }; },
    animate: async () => {},
    apply: () => {}
  });
  const p1 = machine.roll('room');
  const p2 = machine.roll('room');
  await p1;
  assert.equal(apiCalls, 1);
  assert.equal(machine.phase, 'IDLE');
  assert.equal(await p2, false); // second call ignored
});

test('rebuild from snapshot', () => {
  const snap = { board: { a: 1 }, positions: { p1: 2 }, currentTurn: 'p1', lastRoll: 3, timers: { p1: 10 }, startedAt: 42 };
  assert.deepEqual(rebuildFromSnapshot(snap), snap);
  assert.deepEqual(rebuildFromSnapshot(), { board: {}, positions: {}, currentTurn: null, lastRoll: null, timers: {}, startedAt: null });
});
