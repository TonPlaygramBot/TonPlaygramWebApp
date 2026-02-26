import { afterEach, beforeEach, test } from '@jest/globals';
import assert from 'node:assert/strict';

const originalWindow = global.window;
const originalFetch = global.fetch;

function createStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key)
  };
}

beforeEach(() => {
  global.window = {
    localStorage: createStorage(),
    location: { origin: 'https://example.test' }
  };
});

afterEach(() => {
  global.window = originalWindow;
  global.fetch = originalFetch;
  jest.resetModules();
  jest.clearAllMocks();
});

test('store purchase forwards accountId in auth header when local storage is empty', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true })
  });

  const { buyBundle } = await import('../webapp/src/utils/api.js');

  const accountId = 'acc_test_123';
  await buyBundle(accountId, {
    items: [{ slug: 'poolroyale', type: 'cue', optionId: 'starter', price: 100 }]
  });

  assert.equal(global.fetch.mock.calls.length, 1);
  const [, request] = global.fetch.mock.calls[0];
  assert.equal(request.headers['X-Tpc-Account-Id'], accountId);
});
