import { describe, expect, test, beforeEach } from '@jest/globals';
import { getPlayerId } from '../webapp/src/utils/telegram.js';

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

  clear() {
    this.store.clear();
  }

  key(index) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length() {
    return this.store.size;
  }
}

function setTelegramUserId(id) {
  const value = id == null ? undefined : id;
  global.window.Telegram = {
    WebApp: {
      initDataUnsafe: {
        user: value == null ? undefined : { id: value }
      }
    }
  };
}

describe('telegram account scoped player ids', () => {
  beforeEach(() => {
    const storage = new MemoryStorage();
    global.localStorage = storage;
    global.window = {
      localStorage: storage,
      location: { search: '' },
      Telegram: { WebApp: { initDataUnsafe: { user: { id: 101 } } } }
    };
  });

  test('returns a distinct account id per Telegram user on shared storage', () => {
    setTelegramUserId(101);
    const accountOneFirstCall = getPlayerId();
    const accountOneSecondCall = getPlayerId();
    expect(accountOneFirstCall).toBeTruthy();
    expect(accountOneSecondCall).toBe(accountOneFirstCall);

    setTelegramUserId(202);
    const accountTwo = getPlayerId();
    expect(accountTwo).toBeTruthy();
    expect(accountTwo).not.toBe(accountOneFirstCall);

    setTelegramUserId(101);
    expect(getPlayerId()).toBe(accountOneFirstCall);
  });

  test('binds legacy global accountId to the first Telegram user for migration', () => {
    global.localStorage.setItem('accountId', 'legacy-account-id');
    setTelegramUserId(555);

    expect(getPlayerId()).toBe('legacy-account-id');

    setTelegramUserId(777);
    const secondAccount = getPlayerId();
    expect(secondAccount).toBeTruthy();
    expect(secondAccount).not.toBe('legacy-account-id');

    setTelegramUserId(555);
    expect(getPlayerId()).toBe('legacy-account-id');
  });
});
