import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Simulates React's asynchronous state updates by queueing
 * updater functions and applying them sequentially.
 */
function createState(initial) {
  let state = initial;
  const queue = [];
  const setState = (updater) => {
    queue.push(updater);
  };
  const flush = () => {
    while (queue.length) {
      const updater = queue.shift();
      state = updater(state);
    }
  };
  const getState = () => state;
  return { setState, flush, getState };
}

test('AI moves update only their own token', () => {
  const { setState: setAiPositions, flush, getState } = createState([0, 0]);

  // Schedule two moves concurrently for AI 1 and AI 2
  setAiPositions(arr => arr.map((p, i) => (i === 0 ? 3 : p)));
  setAiPositions(arr => arr.map((p, i) => (i === 1 ? 5 : p)));

  flush();

  assert.deepEqual(getState(), [3, 5]);
});
