import { beforeEach, describe, expect, test } from '@jest/globals';
import { ensureAccountId } from '../webapp/src/utils/telegram.js';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  key(index) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length() {
    return this.store.size;
  }
}

describe('ensureAccountId', () => {
  beforeEach(() => {
    const storage = new MemoryStorage();
    global.localStorage = storage;
    global.window = {
      localStorage: storage,
      location: { origin: 'http://localhost', search: '' },
      Telegram: undefined
    };
  });

  test('resolves to server TPC account id for google identity', async () => {
    global.localStorage.setItem(
      'googleProfile',
      JSON.stringify({ id: 'google-user-11', firstName: 'Gigi' })
    );

    let requestBody = null;
    global.fetch = async (_url, options = {}) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ accountId: 'tpc-server-11' })
      };
    };

    const resolved = await ensureAccountId();
    expect(resolved).toBe('tpc-server-11');
    expect(requestBody?.googleId).toBe('google-user-11');
    expect(requestBody?.accountId).toBeTruthy();
  });

  test('falls back to local scoped id when account create request fails', async () => {
    global.localStorage.setItem('googleId', 'google-user-fallback');

    global.fetch = async () => {
      throw new Error('network down');
    };

    const resolved = await ensureAccountId();
    expect(resolved).toBeTruthy();
    expect(typeof resolved).toBe('string');
    expect(resolved).toBe(global.localStorage.getItem('accountId'));
  });
});
