import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import { post } from '../webapp/src/utils/api.js';

jest.mock('../webapp/src/utils/nativeBridge', () => ({ getNativeBridgeHeaders: () => ({}) }));

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
}

describe('api authentication rejects public identity headers', () => {
  const originalWindow = global.window;
  const originalFetch = global.fetch;

  beforeEach(() => {
    const storage = new MemoryStorage();
    global.window = {
      localStorage: storage,
      Capacitor: null,
      Telegram: null
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}'
    });
  });

  afterEach(() => {
    global.window = originalWindow;
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test('does not send X-Google-Id as authentication for a cached profile', async () => {
    window.localStorage.setItem('googleProfile', JSON.stringify({ id: 'google-profile-only' }));
    window.localStorage.removeItem('googleId');

    await post('/api/ping', { ok: true });

    const fetchOptions = global.fetch.mock.calls[0][1];
    expect(fetchOptions.headers['X-Google-Id']).toBeUndefined();
    expect(fetchOptions.headers.Authorization).toBeUndefined();
  });

  test('returns a useful error for a long rate-limit response without retrying', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: { get: () => '900' },
      text: async () => 'Too many requests'
    });

    const result = await post('/api/profile/get', { telegramId: 123 });

    expect(result).toEqual({
      error: 'Too many requests. Please wait a moment and try again.'
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
