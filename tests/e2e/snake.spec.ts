import { test, expect } from '@playwright/test';
import { createRollStateMachine } from '../../webapp/src/utils/rollStateMachine.js';

test('roll ignores double tap', async () => {
  let apiCalls = 0;
  const machine = createRollStateMachine({
    apiRoll: async () => { apiCalls++; return { value: 3, sig: 's' }; },
    animate: async () => {},
    apply: () => {}
  });
  const first = machine.roll('room');
  const second = machine.roll('room');
  await first;
  expect(apiCalls).toBe(1);
  expect(await second).toBe(false);
  expect(machine.phase).toBe('IDLE');
});
