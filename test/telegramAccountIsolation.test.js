import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { getPlayerId, getTelegramId } from '../webapp/src/utils/telegram.js';

jest.mock('../webapp/src/utils/api.js', () => ({ fetchTelegramInfo: jest.fn() }));

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

  test('uses the canonical verified Google account outside Telegram', () => {
    setTelegramUserId(null);
    global.localStorage.setItem('googleId', 'google-user-1');
    global.localStorage.setItem('accountId', 'server-google-account');
    global.localStorage.setItem('accountId:google:google-user-1', 'server-google-account');
    global.localStorage.setItem('googleSessionAccountId', 'server-google-account');
    global.localStorage.setItem('tpgSessionToken', 'verified-google-session');
    expect(getPlayerId()).toBe('server-google-account');
  });

  test('legacy Google cache cannot replace a new signed guest account', () => {
    setTelegramUserId(null);
    global.localStorage.setItem('googleId', 'old-google');
    global.localStorage.setItem('googleProfile', JSON.stringify({ id: 'old-google' }));
    global.localStorage.setItem('accountId:google:old-google', 'old-account');
    global.localStorage.setItem('accountId', 'new-guest-account');
    global.localStorage.setItem('tpgSessionToken', 'new-guest-session');
    expect(getPlayerId()).toBe('new-guest-account');
    expect(global.localStorage.getItem('accountId')).toBe('new-guest-account');
  });

  test('a Google marker from another account cannot replace the active guest account', () => {
    setTelegramUserId(null);
    global.localStorage.setItem('googleId', 'old-google');
    global.localStorage.setItem('googleSessionAccountId', 'old-account');
    global.localStorage.setItem('accountId:google:old-google', 'old-account');
    global.localStorage.setItem('accountId', 'new-guest-account');
    global.localStorage.setItem('tpgSessionToken', 'new-guest-session');
    expect(getPlayerId()).toBe('new-guest-account');
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
