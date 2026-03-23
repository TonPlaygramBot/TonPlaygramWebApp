import { describe, expect, test, beforeEach } from '@jest/globals';
import { getPlayerId, getTelegramId } from '../webapp/src/utils/telegram.js';

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

  test('uses google scoped ids when running outside Telegram context', () => {
    setTelegramUserId(null);
    global.localStorage.setItem('googleId', 'google-user-1');

    const googleOneFirst = getPlayerId();
    const googleOneSecond = getPlayerId();
    expect(googleOneFirst).toBeTruthy();
    expect(googleOneSecond).toBe(googleOneFirst);

    global.localStorage.setItem('googleId', 'google-user-2');
    const googleTwo = getPlayerId();
    expect(googleTwo).toBeTruthy();
    expect(googleTwo).not.toBe(googleOneFirst);

    global.localStorage.setItem('googleId', 'google-user-1');
    expect(getPlayerId()).toBe(googleOneFirst);
  });

  test('does not reuse telegram account id for a different google identity in shared storage', () => {
    setTelegramUserId(101);
    const telegramScoped = getPlayerId();
    expect(telegramScoped).toBeTruthy();

    setTelegramUserId(null);
    global.localStorage.setItem('googleId', 'google-user-99');
    const googleScoped = getPlayerId();

    expect(googleScoped).toBeTruthy();
    expect(googleScoped).not.toBe(telegramScoped);
  });

  test('does not return cached telegramId outside Telegram webview', () => {
    setTelegramUserId(null);
    global.window.Telegram = undefined;
    global.localStorage.setItem('telegramId', '5555');

    expect(getTelegramId()).toBeNull();
  });

  test('returns cached telegramId only while Telegram webview is present', () => {
    setTelegramUserId(1234);
    expect(getTelegramId()).toBe(1234);

    // Runtime Telegram id disappears but Telegram WebApp context still exists.
    global.window.Telegram = { WebApp: { initDataUnsafe: {}, platform: 'ios' } };

    expect(getTelegramId()).toBe(1234);
  });
});
